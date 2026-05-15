import type { NormalizedHttpBody } from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import type { z } from "zod";

export type OpenApiBodySchemaResolution<TWarning> = {
  readonly schema: JsonSchema;
  readonly schemaKey: string;
  readonly warnings: readonly TWarning[];
};

const OPEN_API_BINARY_SCHEMA = {
  type: "string",
  format: "binary",
} satisfies JsonSchema;

export function resolveOpenApiBodySchema<TWarning>(
  body: NormalizedHttpBody,
  registerSchema: () => OpenApiBodySchemaResolution<TWarning>
): OpenApiBodySchemaResolution<TWarning> {
  return shouldUseBinarySchema(body)
    ? {
        schema: OPEN_API_BINARY_SCHEMA,
        schemaKey: "openapi-binary",
        warnings: [],
      }
    : registerSchema();
}

function shouldUseBinarySchema(body: NormalizedHttpBody): boolean {
  return (
    body.transport === "raw" &&
    mediaTypeEssence(body.mediaType) === "application/octet-stream" &&
    (body.mediaTypeSource === "raw-fallback" ||
      isAmbiguousRawSchema(body.schema))
  );
}

function mediaTypeEssence(mediaType: string): string {
  return mediaType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function isAmbiguousRawSchema(schema: z.ZodType): boolean {
  const schemaType = getSchemaType(unwrapTransparentSchema(schema));

  return schemaType === "any" || schemaType === "unknown";
}

function unwrapTransparentSchema(schema: z.ZodType): z.ZodType {
  const visitedSchemas = new Set<z.ZodType>();
  let current = schema;

  while (!visitedSchemas.has(current)) {
    visitedSchemas.add(current);

    const definition = getSchemaDefinition(current);
    const innerType = definition?.innerType;

    if (
      innerType !== undefined &&
      (definition?.type === "optional" ||
        definition?.type === "nullable" ||
        definition?.type === "default" ||
        definition?.type === "catch" ||
        definition?.type === "prefault" ||
        definition?.type === "readonly")
    ) {
      current = innerType;
      continue;
    }

    return current;
  }

  return current;
}

function getSchemaType(schema: z.ZodType | undefined): string | undefined {
  return getSchemaDefinition(schema)?.type;
}

function getSchemaDefinition(schema: z.ZodType | undefined):
  | {
      readonly type?: string;
      readonly innerType?: z.ZodType;
    }
  | undefined {
  const schemaWithDefinition = schema as
    | {
        readonly def?: {
          readonly type?: string;
          readonly innerType?: z.ZodType;
        };
        readonly _def?: {
          readonly type?: string;
          readonly innerType?: z.ZodType;
        };
      }
    | undefined;

  return schemaWithDefinition?.def ?? schemaWithDefinition?._def;
}
