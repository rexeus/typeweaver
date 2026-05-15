import type { JsonSchema, JsonSchemaValue } from "../types.js";

const SCHEMA_CHILD_KEYS: ReadonlySet<string> = new Set([
  "items",
  "contains",
  "propertyNames",
  "if",
  "then",
  "else",
  "not",
]);

const OBJECT_SCHEMA_CHILD_KEYS: ReadonlySet<string> = new Set([
  "additionalProperties",
]);

const SCHEMA_CHILD_MAP_KEYS: ReadonlySet<string> = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
]);

const SCHEMA_CHILD_ARRAY_KEYS: ReadonlySet<string> = new Set([
  "prefixItems",
  "allOf",
  "anyOf",
  "oneOf",
]);

export function normalizeJsonSchema(schema: JsonSchema): JsonSchema {
  const normalizedSchema = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      normalizeSchemaKeyword(schema, key, value),
    ])
  ) as JsonSchema;

  if (!isTupleSchema(normalizedSchema)) {
    return normalizedSchema;
  }

  return normalizeTupleSchema(normalizedSchema);
}

function normalizeTupleSchema(
  schema: JsonSchema & { readonly prefixItems: readonly JsonSchemaValue[] }
): JsonSchema {
  const itemCount = schema.prefixItems.length;
  const minItems = schema.minItems ?? itemCount;

  if (hasOwnSchemaKeyword(schema, "items")) {
    return { ...schema, minItems };
  }

  return {
    ...schema,
    items: schema.items ?? {},
    minItems,
    maxItems: schema.maxItems ?? itemCount,
  };
}

function normalizeSchemaKeyword(
  parent: JsonSchema,
  key: string,
  value: JsonSchemaValue
): JsonSchemaValue {
  if (SCHEMA_CHILD_KEYS.has(key) && isJsonSchema(value)) {
    return normalizeJsonSchema(value);
  }

  if (
    OBJECT_SCHEMA_CHILD_KEYS.has(key) &&
    parent.type === "object" &&
    isJsonSchema(value)
  ) {
    return normalizeJsonSchema(value);
  }

  if (SCHEMA_CHILD_MAP_KEYS.has(key) && isJsonSchema(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        isJsonSchema(childValue) ? normalizeJsonSchema(childValue) : childValue,
      ])
    );
  }

  if (SCHEMA_CHILD_ARRAY_KEYS.has(key) && Array.isArray(value)) {
    return value.map(entry =>
      isJsonSchema(entry) ? normalizeJsonSchema(entry) : entry
    );
  }

  return value;
}

function isTupleSchema(
  schema: JsonSchema
): schema is JsonSchema & { readonly prefixItems: readonly JsonSchemaValue[] } {
  return schema.type === "array" && Array.isArray(schema.prefixItems);
}

function isJsonSchema(value: JsonSchemaValue): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnSchemaKeyword(schema: JsonSchema, keyword: string): boolean {
  return Object.prototype.hasOwnProperty.call(schema, keyword);
}
