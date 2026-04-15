import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { compareRoutes, toPascalCase } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";

export function generate(context: GeneratorContext): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const templateFile = path.join(moduleDir, "templates", "HonoRouter.ejs");

  for (const resource of context.normalizedSpec.resources) {
    writeHonoRouter(resource, templateFile, context);
  }
}

function writeHonoRouter(
  resource: NormalizedResource,
  templateFile: string,
  context: GeneratorContext
): void {
  const pascalCaseEntityName = toPascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const outputPath = path.join(outputDir, `${pascalCaseEntityName}Hono.ts`);

  const operations = resource.operations
    .filter(operation => operation.method !== HttpMethod.HEAD)
    .map(operation => createOperationData(outputDir, resource.name, operation, context))
    .sort((a, b) => compareRoutes(a, b));

  const content = context.renderTemplate(templateFile, {
    honoLibPath: context.getLibImportPath({
      importerDir: outputDir,
      pluginName: "hono",
    }),
    entityName: resource.name,
    pascalCaseEntityName,
    operations,
  });

  const relativePath = path.relative(context.outputDir, outputPath);
  context.writeFile(relativePath, content);
}

function createOperationData(
  importerDir: string,
  resourceName: string,
  operation: NormalizedOperation,
  context: GeneratorContext
) {
  const operationId = operation.operationId;
  const className = toPascalCase(operationId);
  const handlerName = `handle${className}Request`;
  const importPaths = context.getOperationImportPaths({
    importerDir,
    pluginName: "types",
    resourceName,
    operationId,
  });

  return {
    operationId,
    className,
    handlerName,
    method: operation.method,
    path: operation.path,
    requestFile: importPaths.requestFile,
    requestValidationFile: importPaths.requestValidationFile,
    responseFile: importPaths.responseFile,
    responseValidationFile: importPaths.responseValidationFile,
  };
}
