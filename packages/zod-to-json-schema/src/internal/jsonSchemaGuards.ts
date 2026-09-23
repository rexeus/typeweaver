import type { JsonSchema, JsonSchemaValue } from "../types.js";

/** Reports whether a value is a JSON value, as produced by `JSON.parse`. */
export function isJsonSchemaValue(value: unknown): value is JsonSchemaValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSchemaValue);
  }
  return isJsonSchemaObject(value);
}

/** Reports whether a value is a JSON object whose enumerable values are JSON. */
export function isJsonSchemaObject(value: unknown): value is JsonSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isJsonSchemaValue)
  );
}
