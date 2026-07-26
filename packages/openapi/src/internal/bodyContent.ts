import type { NormalizedHttpBody } from "@rexeus/typeweaver-gen";
import type { JsonSchema } from "@rexeus/typeweaver-zod-to-json-schema";
import {
  getSchemaDefinition,
  getSchemaType,
  isZodTransparentWrapperType,
} from "./zodIntrospection.js";
import type { ZodTransparentWrapperType } from "./zodIntrospection.js";
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
const RAW_BODY_TRANSPARENT_WRAPPER_TYPES: ReadonlySet<ZodTransparentWrapperType> =
  new Set([
    "optional",
    "nullable",
    "default",
    "catch",
    "prefault",
    "readonly",
    "nonoptional",
  ]);

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

function isAmbiguousRawSchema(schema: z.core.$ZodType): boolean {
  const schemaType = getSchemaType(unwrapTransparentSchema(schema));

  return schemaType === "any" || schemaType === "unknown";
}

type UnwrapSchemaStep =
  | { readonly _tag: "Continue"; readonly schema?: z.core.$ZodType }
  | { readonly _tag: "Done"; readonly schema?: z.core.$ZodType };

const isOpaquePipeOutput = (outputType: string | undefined): boolean =>
  outputType === undefined || outputType === "transform";

function unwrapSchemaStep(schema: z.core.$ZodType): UnwrapSchemaStep {
  const definition = getSchemaDefinition(schema);
  const schemaType = definition?.type;

  if (
    isZodTransparentWrapperType(schemaType, RAW_BODY_TRANSPARENT_WRAPPER_TYPES)
  ) {
    return { _tag: "Continue", schema: definition?.innerType };
  }

  if (schemaType === "pipe") {
    const outputType = getSchemaType(definition?.out);
    return isOpaquePipeOutput(outputType)
      ? { _tag: "Done" }
      : { _tag: "Continue", schema: definition?.out };
  }

  if (schemaType === "effects") {
    return { _tag: "Continue", schema: definition?.schema };
  }

  return { _tag: "Done", schema };
}

function unwrapTransparentSchema(
  schema: z.core.$ZodType
): z.core.$ZodType | undefined {
  const visitedSchemas = new Set<z.core.$ZodType>();
  let current: z.core.$ZodType | undefined = schema;

  while (current !== undefined && !visitedSchemas.has(current)) {
    visitedSchemas.add(current);

    const step = unwrapSchemaStep(current);
    if (step._tag === "Done") {
      return step.schema;
    }
    current = step.schema;
  }

  return current;
}
