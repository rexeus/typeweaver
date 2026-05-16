import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { buildOpenApiDocument } from "./buildOpenApiDocument.js";
import { normalizeOpenApiPluginOptions } from "./internal/normalizeOptions.js";
import type { OpenApiBuildWarning } from "./types.js";

export type { OpenApiPluginOptions } from "./internal/normalizeOptions.js";

const PLUGIN_NAME = "openapi";

/**
 * Build an OpenAPI plugin. Options are validated and normalized eagerly so
 * misconfiguration surfaces at composition time, not during generation.
 */
export const openApiPlugin = (options: unknown = {}): Plugin => {
  const normalized = normalizeOpenApiPluginOptions(options);

  return definePlugin({
    name: PLUGIN_NAME,
    generate: context =>
      Effect.try({
        try: () => {
          const result = buildOpenApiDocument(context.normalizedSpec, {
            info: normalized.info,
            ...(normalized.servers !== undefined
              ? { servers: normalized.servers }
              : {}),
          });
          const json = `${JSON.stringify(result.document, null, 2)}\n`;
          context.writeFile(normalized.outputPath, json);

          if (result.warnings.length > 0) {
            console.warn(formatWarnings(result.warnings));
          }
        },
        catch: cause =>
          new PluginExecutionError({
            pluginName: PLUGIN_NAME,
            phase: "generate",
            cause,
          }),
      }),
  });
};

const formatWarnings = (warnings: readonly OpenApiBuildWarning[]): string => {
  const warningLines = warnings.map(
    warning => `- ${warning.code}: ${warning.message} (${warning.documentPath})`
  );

  return [
    `OpenAPI generation completed with ${warnings.length} warning(s).`,
    ...warningLines,
  ].join("\n");
};

export default openApiPlugin;
