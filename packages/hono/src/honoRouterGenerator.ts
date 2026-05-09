import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  compareRoutes,
  createJSDocComment,
  relative,
} from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { pascalCase } from "polycase";

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
  const pascalCaseEntityName = pascalCase(resource.name);
  const outputDir = context.getResourceOutputDir(resource.name);
  const outputPath = path.join(outputDir, `${pascalCaseEntityName}Hono.ts`);

  const operations = resource.operations
    // Hono handles HEAD requests automatically, so we skip them
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

function createOperationData(operation: NormalizedOperation) {
  const operationId = operation.operationId;
  const className = pascalCase(operationId);
  const handlerName = `handle${className}Request`;
  const jsDoc = createJSDocComment(operation.summary, { indentation: "  " });

  return {
    operationId,
    className,
    handlerName,
    ...(jsDoc ? { jsDoc } : {}),
    method: operation.method,
    path: operation.path,
  };
}
