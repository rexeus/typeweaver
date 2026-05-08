import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { compareRoutes, relative } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { pascalCase } from "polycase";

export type RouterGenerationContext = Pick<
  GeneratorContext,
  | "normalizedSpec"
  | "outputDir"
  | "getResourceOutputDir"
  | "renderTemplate"
  | "writeFile"
>;

type OperationData = {
  readonly operationId: string;
  readonly className: string;
  readonly handlerName: string;
  readonly method: string;
  readonly path: string;
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
export function generate(context: RouterGenerationContext): void {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const templateFile = path.join(moduleDir, "templates", "Router.ejs");

  for (const resource of context.normalizedSpec.resources) {
    writeRouter(resource, templateFile, context);
  }
}

function writeRouter(
  resource: NormalizedResource,
  templateFile: string,
  context: RouterGenerationContext
): void {
  const pascalCaseEntityName = pascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const outputPath = path.join(outputDir, `${pascalCaseEntityName}Router.ts`);

  const operations = resource.operations
    .filter(operation => operation.method !== HttpMethod.HEAD)
    .map(operation => createOperationData(operation))
    .sort((a, b) => compareRoutes(a, b));

  const content = context.renderTemplate(templateFile, {
    coreDir: relative(outputDir, context.outputDir),
    entityName: resource.name,
    pascalCaseEntityName,
    operations,
  });

  const relativePath = path.relative(context.outputDir, outputPath);
  context.writeFile(relativePath, content);
}

function createOperationData(operation: NormalizedOperation): OperationData {
  const operationId = operation.operationId;
  const className = pascalCase(operationId);

  return {
    operationId,
    className,
    handlerName: `handle${className}Request`,
    method: operation.method,
    path: operation.path,
  };
}
