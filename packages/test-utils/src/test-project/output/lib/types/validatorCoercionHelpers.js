import { z } from "zod";
import { analyzeSchema, finiteStringOutputs, isArraySchema } from "./validatorSchemaAnalysis.js";
/**
 * Coerces a record container with value-schema-aware cardinality.
 * Query keys and non-finite header keys preserve their transport casing.
 * Finite header keys are restored to their single declared casing. When the
 * value schema expects an array, a singleton value is wrapped and, for
 * headers (`splitCommaDelimited`), a comma-delimited string is split into a
 * list. Scalar values keep their raw shape so Zod can reject multiplicity.
 */
export function coerceRecordToSchema(data, keyType, valueType, splitCommaDelimited) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
  const expectsArray = isArraySchema(valueType);
  const coerced = Object.create(null);
  for (const [key, value] of Object.entries(data)) {
    const outputKey = splitCommaDelimited ? canonicalHeaderRecordKey(key, keyType) : key;
    const normalized =
      splitCommaDelimited && expectsArray && typeof value === "string"
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part !== "")
        : value;
    addValueToCoerced(coerced, outputKey, normalized, expectsArray);
  }
  return coerced;
}
function canonicalHeaderRecordKey(rawKey, keyType) {
  const finiteKeys = finiteStringOutputs(keyType);
  if (finiteKeys === undefined) return rawKey;
  const matches = new Set(
    finiteKeys.filter((candidate) => candidate.toLowerCase() === rawKey.toLowerCase()),
  );
  return matches.size === 1 ? ([...matches][0] ?? rawKey) : rawKey;
}
/**
 * Splits comma-separated header strings into arrays per RFC 7230. Only
 * applies to fields where the schema expects an array type.
 */
export function splitCommaDelimitedValues(header, shape) {
  const schemaMap = analyzeSchema(shape, false);
  const result = Object.create(null);
  for (const [key, value] of Object.entries(header)) {
    if (schemaMap.get(key.toLowerCase())?.isArray && typeof value === "string") {
      setOwnValue(
        result,
        key,
        value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v !== ""),
      );
    } else {
      setOwnValue(result, key, value);
    }
  }
  return result;
}
/**
 * Adds a value to the coerced object, preserving all values as arrays when
 * duplicate keys collide.
 */
export function addValueToCoerced(coerced, key, value, expectsArray) {
  const existing = getOwnValue(coerced, key);
  const newValue = coerceValueStructure(value, expectsArray);
  if (existing === undefined) {
    setOwnValue(coerced, key, newValue);
    return;
  }
  const existingArray = Array.isArray(existing) ? existing : [existing];
  const newArray = Array.isArray(newValue) ? newValue : [newValue];
  const merged = [...existingArray, ...newArray];
  setOwnValue(coerced, key, expectsArray || merged.length > 1 ? merged : merged[0]);
}
/** Reads an own property so dynamic keys cannot use inherited values. */
function getOwnValue(source, key) {
  return Object.hasOwn(source, key) ? source[key] : undefined;
}
/** Writes an own enumerable property without treating `__proto__` specially. */
export function setOwnValue(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
/** Aligns scalar and array values with the schema's expected cardinality. */
function coerceValueStructure(value, expectsArray) {
  if (expectsArray && !Array.isArray(value)) return [value];
  if (!expectsArray && Array.isArray(value) && value.length === 1) return value[0];
  return value;
}
/** Restores schema-defined casing after case-insensitive coercion. */
export function mapToOriginalKeys(coerced, schemaMap) {
  const withOriginalKeys = Object.create(null);
  for (const [key, value] of Object.entries(coerced)) {
    setOwnValue(withOriginalKeys, schemaMap.get(key)?.originalKey ?? key, value);
  }
  return withOriginalKeys;
}
