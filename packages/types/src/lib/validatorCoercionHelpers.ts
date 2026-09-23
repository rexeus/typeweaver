import { z } from "zod";
import {
  analyzeSchema,
  finiteStringOutputs,
  isArraySchema,
} from "./validatorSchemaAnalysis.js";
import type { $ZodShape } from "zod/v4/core";

/**
 * Coerces a record container with value-schema-aware cardinality.
 * Query keys and non-finite header keys preserve their transport casing.
 * Finite header keys are restored to their single declared casing. When the
 * value schema expects an array, a singleton value is wrapped and, for
 * headers (`splitCommaDelimited`), a comma-delimited string is split into a
 * list. Scalar values keep their raw shape so Zod can reject multiplicity.
 */
export function coerceRecordToSchema(
  data: unknown,
  keyType: z.core.$ZodType,
  valueType: z.core.$ZodType,
  splitCommaDelimited: boolean
): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return data;
  const expectsArray = isArraySchema(valueType);
  const coerced = createNullPrototypeRecord<unknown | unknown[]>();
  const entries: [string, unknown][] = Object.entries(data);
  for (const [key, value] of entries) {
    const outputKey = splitCommaDelimited
      ? canonicalHeaderRecordKey(key, keyType)
      : key;
    const normalized =
      splitCommaDelimited && expectsArray && typeof value === "string"
        ? value
            .split(",")
            .map(part => part.trim())
            .filter(part => part !== "")
        : value;
    addValueToCoerced(coerced, outputKey, normalized, expectsArray);
  }
  return coerced;
}

function canonicalHeaderRecordKey(
  rawKey: string,
  keyType: z.core.$ZodType
): string {
  const finiteKeys = finiteStringOutputs(keyType);
  if (finiteKeys === undefined) return rawKey;
  const matches = new Set(
    finiteKeys.filter(
      candidate => candidate.toLowerCase() === rawKey.toLowerCase()
    )
  );
  return matches.size === 1 ? ([...matches][0] ?? rawKey) : rawKey;
}

/**
 * Splits comma-separated header strings into arrays per RFC 7230.
 * Only applies to fields where the schema expects an array type.
 * Values that are already arrays pass through unchanged.
 */
export function splitCommaDelimitedValues(
  header: object,
  shape: $ZodShape
): Record<string, unknown> {
  const schemaMap = analyzeSchema(shape, false);
  const result = createNullPrototypeRecord<unknown>();
  for (const [key, value] of Object.entries(header)) {
    if (
      schemaMap.get(key.toLowerCase())?.isArray &&
      typeof value === "string"
    ) {
      setOwnValue(
        result,
        key,
        value
          .split(",")
          .map(v => v.trim())
          .filter(v => v !== "")
      );
    } else {
      setOwnValue(result, key, value);
    }
  }
  return result;
}

/**
 * Adds a value to the coerced object, handling collisions when multiple
 * values exist for the same key (e.g., duplicate headers with different
 * casing). Preserves all values as arrays when collisions occur.
 */
export function addValueToCoerced(
  coerced: Record<string, unknown | unknown[]>,
  key: string,
  value: unknown,
  expectsArray: boolean
): void {
  const existing = getOwnValue(coerced, key);
  const newValue = coerceValueStructure(value, expectsArray);
  if (existing === undefined) {
    setOwnValue(coerced, key, newValue);
    return;
  }
  const existingArray: unknown[] = Array.isArray(existing)
    ? existing
    : [existing];
  const newArray: unknown[] = Array.isArray(newValue) ? newValue : [newValue];
  const merged = [...existingArray, ...newArray];
  // If schema expects a single value but we have multiple, preserve as array
  // to avoid data loss (validation will catch this later)
  setOwnValue(
    coerced,
    key,
    expectsArray || merged.length > 1 ? merged : merged[0]
  );
}

/**
 * Creates an empty record without a prototype, so dynamic keys never resolve
 * inherited members such as `constructor` or `__proto__`.
 */
export function createNullPrototypeRecord<TValue>(): Record<string, TValue> {
  const record: Record<string, TValue> = {};
  Object.setPrototypeOf(record, null);
  return record;
}

/**
 * Reads an own property only. Dynamic record/header keys such as
 * `constructor` or `toString` must not collide with inherited values.
 */
function getOwnValue<TValue>(
  source: Record<string, TValue>,
  key: string
): TValue | undefined {
  return Object.hasOwn(source, key) ? source[key] : undefined;
}
/**
 * Writes an own enumerable data property. Dynamic keys such as `__proto__`
 * become ordinary keys rather than mutating the object prototype.
 */
export function setOwnValue<TValue>(
  target: Record<string, TValue>,
  key: string,
  value: TValue
): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
/**
 * Coerces a value's structure to match schema expectations.
 * Wraps single values in arrays when schema expects array type,
 * unwraps single-element arrays when schema expects single value.
 */
function coerceValueStructure(
  value: unknown,
  expectsArray: boolean
): unknown | unknown[] {
  if (expectsArray && !Array.isArray(value)) return [value];
  if (!expectsArray && Array.isArray(value) && value.length === 1)
    return value[0];
  return value;
}

/**
 * Maps normalized (lowercase) keys back to their original casing as defined
 * in the schema. Used for case-insensitive matching where the output should
 * preserve schema-defined casing.
 */
export function mapToOriginalKeys(
  coerced: Record<string, unknown | unknown[]>,
  schemaMap: Map<string, { readonly originalKey: string }>
): Record<string, unknown | unknown[]> {
  const withOriginalKeys = createNullPrototypeRecord<unknown | unknown[]>();
  for (const [key, value] of Object.entries(coerced)) {
    setOwnValue(
      withOriginalKeys,
      schemaMap.get(key)?.originalKey ?? key,
      value
    );
  }
  return withOriginalKeys;
}
