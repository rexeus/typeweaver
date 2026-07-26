import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import type { OpenApiPluginOptions } from "@rexeus/typeweaver-openapi";
import { buildOpenApiDocument } from "@rexeus/typeweaver-openapi";

export const pluginOptions = {
  target: "3.2.0",
  servers: [{ url: "https://api.example.com" }],
  outputPath: "openapi/openapi.json",
} satisfies OpenApiPluginOptions;

export const buildDocument = (normalizedSpec: NormalizedSpec) =>
  buildOpenApiDocument(normalizedSpec, {
    target: pluginOptions.target,
    servers: pluginOptions.servers,
  });
