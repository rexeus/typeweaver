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
 * All other schema shapes pass through unchanged.
 */
export function normalizeJsonSchema(schema: JsonSchema): JsonSchema {
  const normalizedSchema = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      normalizeJsonSchemaValue(value),
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

function normalizeJsonSchemaValue(value: JsonSchemaValue): JsonSchemaValue {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonSchemaValue);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (isJsonSchemaObject(value)) {
    return normalizeJsonSchema(value);
  }

  return value;
}

function isJsonSchemaObject(value: object): value is JsonSchema {
  return !Array.isArray(value);
}
