import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  PluginExecutionError,
  compareRoutes,
  createJSDocComment,
  relative,
} from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResource,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { pascalCase } from "polycase";

export type HonoGenerationContext = Pick<
  GeneratorContext,
  | "normalizedSpec"
  | "outputDir"
  | "getResourceOutputDir"
  | "renderTemplateEffect"
  | "writeFileEffect"
>;

export const generate = Effect.fn("typeweaver.hono.generateRouters")(function* (
  context: HonoGenerationContext
) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const templateFile = path.join(moduleDir, "templates", "HonoRouter.ejs");

  yield* Effect.forEach(
    context.normalizedSpec.resources,
    resource => writeHonoRouter(resource, templateFile, context),
    { discard: true }
  );
});

function writeHonoRouter(
  resource: NormalizedResource,
  templateFile: string,
  context: HonoGenerationContext
): Effect.Effect<void, PluginExecutionError> {
  return Effect.gen(function* () {
    const pascalCaseEntityName = pascalCase(resource.name);
    const outputDir = context.getResourceOutputDir(resource.name);
    const outputPath = path.join(outputDir, `${pascalCaseEntityName}Hono.ts`);

    const operations = resource.operations
      // Hono handles HEAD requests automatically, so we skip them
      .filter(operation => operation.method !== HttpMethod.HEAD)
      .map(operation => createOperationData(operation))
      .sort((a, b) => compareRoutes(a, b));

    const content = yield* context.renderTemplateEffect(templateFile, {
      coreDir: relative(outputDir, context.outputDir),
      entityName: resource.name,
      pascalCaseEntityName,
      operations,
    });

    const relativePath = path.relative(context.outputDir, outputPath);
    yield* context.writeFileEffect(relativePath, content);
  }).pipe(
    Effect.mapError(
      cause =>
        new PluginExecutionError({
          pluginName: "hono",
          phase: "generate",
          cause,
        })
    )
  );
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
