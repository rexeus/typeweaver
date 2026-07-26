import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { buildOpenApiDocument } from "./buildOpenApiDocument.js";
import { normalizeOpenApiPluginOptions } from "./internal/normalizeOptions.js";
import { openApiWarningToIssue } from "./warningIssues.js";
import type { OpenApiPluginOptions } from "./internal/normalizeOptions.js";

export type { OpenApiPluginOptions } from "./internal/normalizeOptions.js";

const PLUGIN_NAME = "openapi";

/**
 * Build an OpenAPI plugin. Options are validated and normalized eagerly so
 * misconfiguration surfaces at composition time, not during generation.
 */
export const openApiPlugin = (options: OpenApiPluginOptions = {}): Plugin => {
  const normalized = normalizeOpenApiPluginOptions(options);

  return definePlugin({
    name: PLUGIN_NAME,
    validate: normalizedSpec =>
      Effect.try({
        try: () =>
          buildOpenApiDocument(normalizedSpec, {
            target: normalized.target,
            ...(normalized.servers === undefined
              ? {}
              : { servers: normalized.servers }),
          }).warnings.map(openApiWarningToIssue),
        catch: cause =>
          new PluginExecutionError({
            pluginName: PLUGIN_NAME,
            phase: "validate",
            cause,
          }),
      }),
    generate: context =>
      Effect.try({
        try: () => {
          const built = buildOpenApiDocument(context.normalizedSpec, {
            target: normalized.target,
            ...(normalized.servers === undefined
              ? {}
              : { servers: normalized.servers }),
          });
          const json = `${JSON.stringify(built.document, null, 2)}\n`;
          context.writeFile(normalized.outputPath, json);
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

export default openApiPlugin;
