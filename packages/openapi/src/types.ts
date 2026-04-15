import type { ZodToJsonSchemaWarning } from "@rexeus/typeweaver-zod-to-json-schema";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";

export type OpenApiDocument = Record<string, unknown>;

export type OpenApiInfo = {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
};

export type OpenApiServer = {
  readonly url: string;
  readonly description?: string;
};

export type OpenApiPluginConfig = {
  readonly info?: OpenApiInfo;
  readonly servers?: readonly OpenApiServer[];
  readonly outputFile?: string;
};

export type OpenApiWarning = {
  readonly code: ZodToJsonSchemaWarning["code"];
  readonly location: string;
  readonly message: string;
};

export type OpenApiBuildResult = {
  readonly document: OpenApiDocument;
  readonly warnings: readonly OpenApiWarning[];
};

export type OpenApiBuilderInput = {
  readonly normalizedSpec: NormalizedSpec;
  readonly config?: OpenApiPluginConfig;
};
