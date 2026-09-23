import { z } from "zod";

export type ZodObjectWithShape = z.ZodObject<Record<string, z.ZodType>> & {
  readonly shape: Record<string, z.ZodType>;
};

type ZodTypeDefinition = {
  readonly type: string | undefined;
  readonly innerType: z.ZodType | undefined;
  readonly schema: z.ZodType | undefined;
  readonly out: z.ZodType | undefined;
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

const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

const readProperty = (source: unknown, key: string): unknown =>
  isObject(source) && key in source ? Reflect.get(source, key) : undefined;

const arrayProperty = (
  source: unknown,
  key: string
): readonly unknown[] | undefined => {
  const value = readProperty(source, key);
  return Array.isArray(value) ? value : undefined;
};

const objectValuesProperty = (
  source: unknown,
  key: string
): readonly unknown[] | undefined => {
  const value = readProperty(source, key);
  return isObject(value) ? Object.values(value) : undefined;
};

/** Zod-like schemas may come from another Zod instance, so they are duck-typed. */
const isSchemaLike = (value: unknown): value is z.ZodType =>
  isObject(value) && "_zod" in value;

const schemaProperty = (
  source: unknown,
  key: string
): z.ZodType | undefined => {
  const value = readProperty(source, key);
  return isSchemaLike(value) ? value : undefined;
};

export const literalSchemaValues = (
  schema: z.core.$ZodType | undefined
): readonly unknown[] => {
  const values = readProperty(schema, "values");
  return values instanceof Set ? Array.from(values) : [];
};

export const enumSchemaValues = (
  schema: z.core.$ZodType | undefined
): readonly unknown[] =>
  arrayProperty(schema, "options") ?? enumDefinitionValues(schema) ?? [];

const enumDefinitionValues = (
  schema: z.core.$ZodType | undefined
): readonly unknown[] | undefined => {
  const definition = readProperty(schema, "def");
  return (
    arrayProperty(definition, "values") ??
    objectValuesProperty(definition, "entries") ??
    objectValuesProperty(schema, "enum")
  );
};

export const getSchemaType = (
  schema: z.core.$ZodType | undefined
): string | undefined => getSchemaDefinition(schema)?.type;

const getSchemaDefinition = (
  schema: z.core.$ZodType | undefined
): ZodTypeDefinition | undefined => {
  const definition =
    readProperty(schema, "def") ?? readProperty(schema, "_def");
  if (!isObject(definition)) return undefined;
  const type = readProperty(definition, "type");
  return {
    type: typeof type === "string" ? type : undefined,
    innerType: schemaProperty(definition, "innerType"),
    schema: schemaProperty(definition, "schema"),
    out: schemaProperty(definition, "out"),
  };
};
