import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { toPascalCase } from "@rexeus/typeweaver-gen";
import { fromZod, print } from "@rexeus/typeweaver-zod-to-ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function generate(context: GeneratorContext): void {
  const clientTemplatePath = path.join(moduleDir, "templates", "Client.ejs");
  const commandTemplatePath = path.join(
    moduleDir,
    "templates",
    "RequestCommand.ejs"
  );

  for (const resource of context.normalizedSpec.resources) {
    writeClient(clientTemplatePath, resource, context);
    writeRequestCommands(commandTemplatePath, resource, context);
  }
}

function writeClient(
  templateFilePath: string,
  resource: NormalizedResource,
  context: GeneratorContext
): void {
  const pascalCaseEntityName = toPascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const clientsLibPath = context.getLibImportPath({
    importerDir: outputDir,
    pluginName: "clients",
  });

  const operations = resource.operations.map(operation => {
    const typeImports = context.getOperationImportPaths({
      importerDir: outputDir,
      pluginName: "types",
      resourceName: resource.name,
      operationId: operation.operationId,
    });

    return {
      operationId: operation.operationId,
      pascalCaseOperationId: toPascalCase(operation.operationId),
      requestCommandFile: `./${toPascalCase(operation.operationId)}RequestCommand.js`,
      responseFile: typeImports.responseFile,
    };
  });

  const content = context.renderTemplate(templateFilePath, {
    clientsLibPath,
    pascalCaseEntityName,
    operations,
  });

  const outputClientFile = path.join(
    outputDir,
    `${pascalCaseEntityName}Client.ts`
  );
  const relativePath = path.relative(context.outputDir, outputClientFile);
  context.writeFile(relativePath, content);
}

function writeRequestCommands(
  templateFilePath: string,
  resource: NormalizedResource,
  context: GeneratorContext
): void {
  resource.operations.forEach(operation => {
    writeRequestCommand(templateFilePath, resource.name, operation, context);
  });
}

function writeRequestCommand(
  templateFilePath: string,
  resourceName: string,
  operation: NormalizedOperation,
  context: GeneratorContext
): void {
  const outputPaths = context.getOperationOutputPaths({
    resourceName,
    operationId: operation.operationId,
  });
  const typeImports = context.getOperationImportPaths({
    importerDir: outputPaths.outputDir,
    pluginName: "types",
    resourceName,
    operationId: operation.operationId,
  });
  const request = operation.request ?? {};
  const pascalCaseOperationId = toPascalCase(operation.operationId);

  const headerTsType = request.header
    ? print(fromZod(request.header))
    : undefined;
  const paramTsType = request.param ? print(fromZod(request.param)) : undefined;
  const queryTsType = request.query ? print(fromZod(request.query)) : undefined;
  const bodyTsType = request.body ? print(fromZod(request.body)) : undefined;

  const content = context.renderTemplate(templateFilePath, {
    resourceName,
    specPath: context.getSpecImportPath({
      importerDir: outputPaths.outputDir,
    }),
    clientsLibPath: context.getLibImportPath({
      importerDir: outputPaths.outputDir,
      pluginName: "clients",
    }),
    typesLibPath: context.getLibImportPath({
      importerDir: outputPaths.outputDir,
      pluginName: "types",
    }),
    operationId: operation.operationId,
    pascalCaseOperationId,
    method: operation.method,
    headerTsType,
    paramTsType,
    queryTsType,
    bodyTsType,
    requestFile: typeImports.requestFile,
    responseValidatorFile: typeImports.responseValidationFile,
    responseFile: typeImports.responseFile,
  });

  const outputCommandFile = path.join(
    outputPaths.outputDir,
    `${pascalCaseOperationId}RequestCommand.ts`
  );
  const relativePath = path.relative(context.outputDir, outputCommandFile);
  context.writeFile(relativePath, content);
}
