import { z } from "zod";

export type ZodObjectWithShape = z.ZodObject<Record<string, z.ZodType>> & {
  readonly shape: Record<string, z.ZodType>;
};

type ZodTypeDefinition = {
  readonly type?: string;
  readonly innerType?: z.ZodType;
  readonly schema?: z.ZodType;
  readonly out?: z.ZodType;
};

type MediaInferenceStep =
  | { readonly _tag: "Continue"; readonly schema?: z.ZodType | undefined }
  | { readonly _tag: "Done"; readonly schema?: z.ZodType | undefined };

const MEDIA_INFERENCE_WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "catch",
  "prefault",
  "readonly",
]);

export const unwrapMediaInferenceSchema = (
  schema: z.ZodType | undefined
): z.ZodType | undefined => {
  const visitedSchemas = new Set<z.ZodType>();
  let current = schema;
  while (current !== undefined && !visitedSchemas.has(current)) {
    visitedSchemas.add(current);
    const step = unwrapMediaInferenceStep(current);
    if (step._tag === "Done") return step.schema;
    current = step.schema;
  }
  return current;
};

const isOpaqueMediaInferenceOutput = (type: string | undefined): boolean =>
  type === undefined || type === "transform";

const unwrapMediaInferencePipe = (
  definition: ZodTypeDefinition | undefined
): MediaInferenceStep =>
  isOpaqueMediaInferenceOutput(getSchemaType(definition?.out))
    ? { _tag: "Done" }
    : { _tag: "Continue", schema: definition?.out };

const unwrapMediaInferenceStep = (schema: z.ZodType): MediaInferenceStep => {
  const definition = getSchemaDefinition(schema);
  const schemaType = definition?.type;
  if (
    schemaType !== undefined &&
    MEDIA_INFERENCE_WRAPPER_TYPES.has(schemaType)
  ) {
    return { _tag: "Continue", schema: definition?.innerType };
  }
  if (schemaType === "pipe") return unwrapMediaInferencePipe(definition);
  return schemaType === "effects"
    ? { _tag: "Continue", schema: definition?.schema }
    : { _tag: "Done", schema };
};

export const unwrapOptional = (
  schema: z.core.$ZodType | undefined
): z.core.$ZodType | undefined =>
  schema instanceof z.ZodOptional ? schema.unwrap() : schema;

export const isZodObject = (
  schema: z.core.$ZodType
): schema is ZodObjectWithShape =>
  getSchemaType(schema) === "object" && "shape" in schema;

export const extractStringLiteralValues = (
  schema: z.core.$ZodType
): readonly string[] => {
  const unwrappedSchema = unwrapOptional(schema);
  if (unwrappedSchema === undefined) return [];
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

export const literalSchemaValues = (
  schema: z.core.$ZodType | undefined
): readonly unknown[] => {
  const literalSchema = schema as
    | { readonly values?: ReadonlySet<unknown> }
    | undefined;
  return Array.from(literalSchema?.values ?? []);
};

export const enumSchemaValues = (
  schema: z.core.$ZodType | undefined
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
  return enumSchema?.options ?? enumDefinitionValues(enumSchema) ?? [];
};

const enumDefinitionValues = (
  schema:
    | {
        readonly enum?: Record<string, unknown>;
        readonly def?: {
          readonly entries?: Record<string, unknown>;
          readonly values?: readonly unknown[];
        };
      }
    | undefined
): readonly unknown[] | undefined => {
  if (schema === undefined) return undefined;
  return (
    schema.def?.values ??
    (schema.def?.entries === undefined
      ? undefined
      : Object.values(schema.def.entries)) ??
    (schema.enum === undefined ? undefined : Object.values(schema.enum))
  );
};

export const getSchemaType = (
  schema: z.core.$ZodType | undefined
): string | undefined => getSchemaDefinition(schema)?.type;

const getSchemaDefinition = (
  schema: z.core.$ZodType | undefined
): ZodTypeDefinition | undefined => {
  const schemaWithDefinition = schema as
    | { readonly def?: ZodTypeDefinition; readonly _def?: ZodTypeDefinition }
    | undefined;
  return schemaWithDefinition?.def ?? schemaWithDefinition?._def;
};
