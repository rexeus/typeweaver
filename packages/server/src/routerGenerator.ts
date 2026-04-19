import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { compareRoutes, toPascalCase } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";

type OperationData = {
  readonly operationId: string;
  readonly className: string;
  readonly handlerName: string;
  readonly method: string;
  readonly path: string;
  readonly requestFile: string;
  readonly requestValidationFile: string;
  readonly responseFile: string;
  readonly responseValidationFile: string;
};

/**
 * Generates TypeweaverRouter subclasses from API definitions.
 *
 * For each resource (e.g., `Todo`, `Account`), produces a `<ResourceName>Router.ts`
 * file that extends `TypeweaverRouter` and registers all operations as routes.
 */

/**
 * Generates router files for all resources in the given context.
 *
 * @param context - The generator context containing resources, templates, and output configuration
 */
export function generate(context: GeneratorContext): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const templateFile = path.join(moduleDir, "templates", "Router.ejs");

  for (const resource of context.normalizedSpec.resources) {
    writeRouter(resource, templateFile, context);
  }
}

function writeRouter(
  resource: NormalizedResource,
  templateFile: string,
  context: GeneratorContext
): void {
  const pascalCaseEntityName = toPascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const outputPath = path.join(outputDir, `${pascalCaseEntityName}Router.ts`);

  const operations = resource.operations
    .filter(operation => operation.method !== HttpMethod.HEAD)
    .map(operation =>
      createOperationData(outputDir, resource.name, operation, context)
    )
    .sort((a, b) => compareRoutes(a, b));

  const content = context.renderTemplate(templateFile, {
    serverLibPath: context.getLibImportPath({
      importerDir: outputDir,
      pluginName: "server",
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
): OperationData {
  const operationId = operation.operationId;
  const className = toPascalCase(operationId);
  const importPaths = context.getOperationImportPaths({
    importerDir,
    pluginName: "types",
    resourceName,
    operationId,
  });

  return {
    operationId,
    className,
    handlerName: `handle${className}Request`,
    method: operation.method,
    path: operation.path,
    requestFile: importPaths.requestFile,
    requestValidationFile: importPaths.requestValidationFile,
    responseFile: importPaths.responseFile,
    responseValidationFile: importPaths.responseValidationFile,
  };
}
