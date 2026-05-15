import type { HttpBodySchema, HttpHeaderSchema } from "@rexeus/typeweaver-core";
import { z } from "zod";
import type {
  NormalizedBodyMediaTypeSource,
  NormalizedBodyTransport,
  NormalizedHttpBody,
  NormalizedSpecWarning,
  NormalizedSpecWarningLocation,
} from "./NormalizedSpec.js";

export type NormalizeBodyInput = {
  readonly bodySchema?: HttpBodySchema;
  readonly headerSchema?: HttpHeaderSchema;
  readonly location: NormalizedSpecWarningLocation;
};

export type NormalizeBodyResult = {
  readonly body?: NormalizedHttpBody;
  readonly warnings: readonly NormalizedSpecWarning[];
};

type ZodObjectWithShape = z.ZodObject<Record<string, z.ZodType>> & {
  readonly shape: Record<string, z.ZodType>;
};

type ContentTypeHeaderResult =
  | { readonly kind: "absent" }
  | { readonly kind: "ambiguous" }
  | { readonly kind: "literal"; readonly value: string };

type ZodTypeDefinition = {
  readonly type?: string;
  readonly innerType?: z.ZodType;
  readonly schema?: z.ZodType;
  readonly in?: z.ZodType;
  readonly out?: z.ZodType;
};

const JSON_BODY_SCHEMA_TYPES = new Set([
  "array",
  "boolean",
  "enum",
  "intersection",
  "literal",
  "null",
  "number",
  "object",
  "record",
  "tuple",
  "union",
]);

export const normalizeBody = (
  input: NormalizeBodyInput
): NormalizeBodyResult => {
  if (input.bodySchema === undefined) {
    return { warnings: [] };
  }

  const warnings: NormalizedSpecWarning[] = [];
  const contentTypeHeader = extractContentTypeHeader(input.headerSchema);

  if (contentTypeHeader.kind === "literal") {
    return {
      body: createNormalizedBody({
        schema: input.bodySchema,
        mediaType: contentTypeHeader.value,
        mediaTypeSource: "content-type-header",
      }),
      warnings,
    };
  }

  if (contentTypeHeader.kind === "ambiguous") {
    warnings.push({
      code: "ambiguous-content-type-header",
      message:
        "Content-Type header is present but does not have one unambiguous literal value; inferred body media type instead.",
      location: input.location,
    });
  } else {
    warnings.push({
      code: "missing-content-type-header",
      message:
        "Body schema is present without a Content-Type header; inferred body media type from schema.",
      location: input.location,
    });
  }

  const inferred = inferBodyMediaType(input.bodySchema);

  if (inferred.mediaTypeSource === "raw-fallback") {
    warnings.push({
      code: "raw-body-media-type-fallback",
      message:
        "Body schema does not imply a concrete media type; used application/octet-stream raw transport fallback.",
      location: input.location,
    });
  }

  return {
    body: createNormalizedBody({
      schema: input.bodySchema,
      ...inferred,
    }),
    warnings,
  };
};

const createNormalizedBody = (input: {
  readonly schema: HttpBodySchema;
  readonly mediaType: string;
  readonly mediaTypeSource: NormalizedBodyMediaTypeSource;
}): NormalizedHttpBody => {
  return {
    schema: input.schema,
    mediaType: input.mediaType,
    mediaTypeSource: input.mediaTypeSource,
    transport: resolveTransport(input.mediaType),
  };
};

const extractContentTypeHeader = (
  headerSchema: HttpHeaderSchema | undefined
): ContentTypeHeaderResult => {
  const headerObject = unwrapOptional(headerSchema);

  if (headerObject === undefined || !isZodObject(headerObject)) {
    return { kind: "absent" };
  }

  const contentTypeEntries = Object.entries(headerObject.shape).filter(
    ([headerName]) => headerName.toLowerCase() === "content-type"
  );

  if (contentTypeEntries.length === 0) {
    return { kind: "absent" };
  }

  const literalValues = contentTypeEntries.flatMap(([, schema]) =>
    extractStringLiteralValues(schema)
  );
  const distinctValues = new Set(literalValues);

  if (contentTypeEntries.length === 1 && distinctValues.size === 1) {
    const [value] = distinctValues;

    return value === undefined
      ? { kind: "ambiguous" }
      : { kind: "literal", value };
  }

  return { kind: "ambiguous" };
};

const inferBodyMediaType = (
  schema: HttpBodySchema
): {
  readonly mediaType: string;
  readonly mediaTypeSource: NormalizedBodyMediaTypeSource;
} => {
  const inferenceSchema = unwrapMediaInferenceSchema(schema);
  const schemaType = getSchemaType(inferenceSchema);

  if (isTextBodySchema(inferenceSchema)) {
    return { mediaType: "text/plain", mediaTypeSource: "body-schema" };
  }

  if (schemaType === "any" || schemaType === "unknown") {
    return {
      mediaType: "application/octet-stream",
      mediaTypeSource: "raw-fallback",
    };
  }

  if (schemaType !== undefined && JSON_BODY_SCHEMA_TYPES.has(schemaType)) {
    return { mediaType: "application/json", mediaTypeSource: "body-schema" };
  }

  return {
    mediaType: "application/octet-stream",
    mediaTypeSource: "raw-fallback",
  };
};

const isTextBodySchema = (schema: z.ZodType | undefined): boolean => {
  const schemaType = getSchemaType(schema);

  if (schemaType === "string") {
    return true;
  }

  if (schemaType === "literal") {
    const values = literalSchemaValues(schema);

    return (
      values.length > 0 && values.every(value => typeof value === "string")
    );
  }

  if (schemaType === "enum") {
    const values = enumSchemaValues(schema);

    return (
      values.length > 0 && values.every(value => typeof value === "string")
    );
  }

  return false;
};

export const resolveTransport = (
  mediaType: string
): NormalizedBodyTransport => {
  const normalizedMediaType = mediaType.split(";")[0]?.trim().toLowerCase();

  if (
    normalizedMediaType === "application/json" ||
    normalizedMediaType?.endsWith("+json") === true
  ) {
    return "json";
  }

  if (normalizedMediaType?.startsWith("text/") === true) {
    return "text";
  }

  if (normalizedMediaType === "application/x-www-form-urlencoded") {
    return "form-url-encoded";
  }

  if (normalizedMediaType === "multipart/form-data") {
    return "multipart";
  }

  return "raw";
};

const unwrapMediaInferenceSchema = (
  schema: z.ZodType | undefined
): z.ZodType | undefined => {
  const visitedSchemas = new Set<z.ZodType>();
  let current = schema;

  while (current !== undefined && !visitedSchemas.has(current)) {
    visitedSchemas.add(current);

    const definition = getSchemaDefinition(current);
    const schemaType = definition?.type;

    if (
      schemaType === "optional" ||
      schemaType === "nullable" ||
      schemaType === "default" ||
      schemaType === "catch" ||
      schemaType === "prefault" ||
      schemaType === "readonly"
    ) {
      current = definition?.innerType;
      continue;
    }

    if (schemaType === "pipe") {
      const outputType = getSchemaType(definition?.out);

      if (outputType === undefined || outputType === "transform") {
        return undefined;
      }

      current = definition?.out;
      continue;
    }

    if (schemaType === "effects") {
      current = definition?.schema;
      continue;
    }

    return current;
  }

  return current;
};

const unwrapOptional = <TSchema extends z.ZodType>(
  schema: TSchema | z.ZodOptional<TSchema> | undefined
): TSchema | undefined => {
  return schema instanceof z.ZodOptional
    ? (schema.unwrap() as TSchema)
    : schema;
};

const isZodObject = (schema: z.ZodType): schema is ZodObjectWithShape => {
  return getSchemaType(schema) === "object" && "shape" in schema;
};

const extractStringLiteralValues = (schema: z.ZodType): readonly string[] => {
  const unwrappedSchema = unwrapOptional(schema);

  if (unwrappedSchema === undefined) {
    return [];
  }

  if (getSchemaType(unwrappedSchema) === "literal") {
    return literalSchemaValues(unwrappedSchema).filter(
      (value): value is string => typeof value === "string"
    );
  }

  if (getSchemaType(unwrappedSchema) === "enum") {
    return enumSchemaValues(unwrappedSchema).filter(
      (value): value is string => typeof value === "string"
    );
  }

  return [];
};

const literalSchemaValues = (
  schema: z.ZodType | undefined
): readonly unknown[] => {
  const literalSchema = schema as
    | {
        readonly values?: ReadonlySet<unknown>;
      }
    | undefined;

  return Array.from(literalSchema?.values ?? []);
};

const enumSchemaValues = (
  schema: z.ZodType | undefined
): readonly unknown[] => {
  const enumSchema = schema as
    | {
        readonly options?: readonly unknown[];
        readonly enum?: Record<string, unknown>;
        readonly def?: {
          readonly entries?: Record<string, unknown>;
          readonly values?: readonly unknown[];
        };
      }
    | undefined;

  return (
    enumSchema?.options ??
    enumSchema?.def?.values ??
    Object.values(enumSchema?.def?.entries ?? enumSchema?.enum ?? {})
  );
};

const getSchemaType = (schema: z.ZodType | undefined): string | undefined => {
  return getSchemaDefinition(schema)?.type;
};

const getSchemaDefinition = (
  schema: z.ZodType | undefined
): ZodTypeDefinition | undefined => {
  const schemaWithDefinition = schema as
    | {
        readonly def?: ZodTypeDefinition;
        readonly _def?: ZodTypeDefinition;
      }
    | undefined;

  return schemaWithDefinition?.def ?? schemaWithDefinition?._def;
};
