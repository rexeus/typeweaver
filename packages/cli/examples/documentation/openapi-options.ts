import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import type { OpenApiPluginOptions } from "@rexeus/typeweaver-openapi";
import { buildOpenApiDocument } from "@rexeus/typeweaver-openapi";

export const pluginOptions = {
  info: { title: "Todo API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  outputPath: "openapi/openapi.json",
} satisfies OpenApiPluginOptions;

export const buildDocument = (normalizedSpec: NormalizedSpec) =>
  buildOpenApiDocument(normalizedSpec, {
    info: pluginOptions.info,
    servers: pluginOptions.servers,
  });
