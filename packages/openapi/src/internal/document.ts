import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { buildSecuritySchemes } from "./security.js";
import type {
  BuildOpenApiDocumentOptions,
  OpenApiComponentsObject,
  OpenApiDocument,
  OpenApiPathsObject,
} from "../types.js";

type DocumentParts = {
  readonly paths: OpenApiPathsObject;
  readonly responses: NonNullable<OpenApiComponentsObject["responses"]>;
  readonly schemas: NonNullable<OpenApiComponentsObject["schemas"]>;
};

export const assembleOpenApiDocument = (
  normalizedSpec: NormalizedSpec,
  options: BuildOpenApiDocumentOptions,
  parts: DocumentParts
): OpenApiDocument => {
  const components = buildComponents(normalizedSpec, parts);

  return {
    openapi: options.target ?? "3.1.2",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: normalizedSpec.metadata.title,
      version: normalizedSpec.metadata.version,
      ...(normalizedSpec.metadata.description === undefined
        ? {}
        : { description: normalizedSpec.metadata.description }),
    },
    ...(options.servers === undefined ? {} : { servers: [...options.servers] }),
    tags: (normalizedSpec.metadata.tags ?? []).map(tag => ({ ...tag })),
    paths: parts.paths,
    ...(normalizedSpec.security.source === "none"
      ? {}
      : { security: normalizedSpec.security.requirements }),
    ...(components === undefined ? {} : { components }),
  };
};

const buildComponents = (
  normalizedSpec: NormalizedSpec,
  parts: DocumentParts
): OpenApiComponentsObject | undefined => {
  const securitySchemes = buildSecuritySchemes(normalizedSpec.securitySchemes);
  const hasResponses = Object.keys(parts.responses).length > 0;
  const hasSchemas = Object.keys(parts.schemas).length > 0;
  const hasSecuritySchemes = Object.keys(securitySchemes).length > 0;

  if (!hasResponses && !hasSchemas && !hasSecuritySchemes) {
    return undefined;
  }

  return {
    ...(hasResponses ? { responses: parts.responses } : {}),
    ...(hasSchemas ? { schemas: parts.schemas } : {}),
    ...(hasSecuritySchemes ? { securitySchemes } : {}),
  };
};
