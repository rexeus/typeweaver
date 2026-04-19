import type { JsonSchema, JsonSchemaValue } from "../types.js";

/**
 * Normalizes a JSON Schema produced by `z.toJSONSchema()` so downstream
 * consumers (OpenAPI 3.1 tooling, code generators, validators) interpret it
 * the same way Zod does at runtime.
 *
 * Zod emits tuples as `{ type: "array", prefixItems: [...] }` without `items`,
 * `minItems`, or `maxItems`. Per JSON Schema Draft 2020-12 that permits
 * additional elements after the prefix — weaker than Zod's fixed-length
 * tuple semantics. This function walks the schema recursively and, for every
 * tuple-shaped object, fills in:
 *
 * - `items: {}` to make the "no additional items" intent explicit
 * - `minItems` / `maxItems` matching the prefix length (unless already set)
 *
 * All other schema shapes pass through unchanged. Recursion only descends into
 * known schema-valued keywords, so data payloads like `default`, `const`, or
 * `examples[i]` are never mutated even if their shape happens to resemble a
 * tuple schema.
 */

const SCHEMA_CHILD_KEYS: ReadonlySet<string> = new Set([
  "items",
  "contains",
  "propertyNames",
  "additionalProperties",
  "unevaluatedItems",
  "unevaluatedProperties",
  "if",
  "then",
  "else",
  "not",
  "contentSchema",
]);

const SCHEMA_CHILD_MAP_KEYS: ReadonlySet<string> = new Set([
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
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
      normalizeSchemaKeyword(key, value),
    ])
  ) as JsonSchema;

  if (
    normalizedSchema.type === "array" &&
    Array.isArray(normalizedSchema.prefixItems) &&
    normalizedSchema.items === undefined
  ) {
    const itemCount = normalizedSchema.prefixItems.length;

    return {
      ...normalizedSchema,
      items: {},
      minItems: normalizedSchema.minItems ?? itemCount,
      maxItems: normalizedSchema.maxItems ?? itemCount,
    };
  }

  return normalizedSchema;
}

function normalizeSchemaKeyword(
  key: string,
  value: JsonSchemaValue
): JsonSchemaValue {
  if (SCHEMA_CHILD_KEYS.has(key) && isPlainObject(value)) {
    return normalizeJsonSchema(value);
  }

  if (SCHEMA_CHILD_MAP_KEYS.has(key) && isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        isPlainObject(childValue)
          ? normalizeJsonSchema(childValue)
          : childValue,
      ])
    );
  }

  if (SCHEMA_CHILD_ARRAY_KEYS.has(key) && Array.isArray(value)) {
    return value.map(entry =>
      isPlainObject(entry) ? normalizeJsonSchema(entry) : entry
    );
  }

  return value;
}

function isPlainObject(value: JsonSchemaValue): value is JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
