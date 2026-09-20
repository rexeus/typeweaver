import type {
  HttpHeaderSchemaLike,
  HttpQuerySchema,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  analyzeSchema,
  fieldExpectsArray,
  finiteStringOutputs,
  getContainerSchema,
  getObjectSchema,
  isArraySchema,
} from "./validatorSchemaAnalysis.js";
import type { $ZodShape } from "zod/v4/core";

export function findMultiplicityIssues(
  data: unknown,
  schema: HttpHeaderSchemaLike | HttpQuerySchema,
  caseSensitive: boolean
): z.core.$ZodIssue[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }

  const issues: z.core.$ZodIssue[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || value.length <= 1) {
      continue;
    }

    if (fieldExpectsArray(schema, key, caseSensitive) === false) {
      issues.push({
        code: "custom",
        input: value,
        path: [key],
        message: "Expected a single HTTP value but received multiple values",
      });
    }
  }

  return issues;
}

/**
 * Coerces objects to match schema expectations with configurable case
 * sensitivity. Values not in the schema are preserved so the container schema
 * can apply its declared strip, passthrough, catchall, or strict behavior.
 */
export function coerceToSchema(
  data: unknown,
  shape: $ZodShape,
  caseSensitive: boolean,
  preserveUnknownKeys: boolean
): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data;
  }

  const schemaMap = analyzeSchema(shape, caseSensitive);
  const coerced: Record<string, unknown | unknown[]> = Object.create(
    null
  ) as Record<string, unknown | unknown[]>;

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = caseSensitive ? key : key.toLowerCase();
    const schemaInfo = schemaMap.get(normalizedKey);

    if (schemaInfo) {
      addValueToCoerced(coerced, normalizedKey, value, schemaInfo.isArray);
    } else if (preserveUnknownKeys) {
      setOwnValue(coerced, key, value);
    }
  }

  // If case-sensitive, return coerced object as is
  if (caseSensitive) {
    return coerced;
  }

  // If case-insensitive, map back to original keys from schema
  return mapToOriginalKeys(coerced, schemaMap);
}

/**
 * Coerces header data to match schema expectations with case-insensitive
 * matching.
 */
export function coerceHeaderToSchema(
  header: unknown,
  schema: HttpHeaderSchemaLike,
  preserveUnknownObjectKeys = false
): unknown {
  if (header === undefined && schema instanceof z.ZodOptional) {
    return undefined;
  }
  const objectSchema = getObjectSchema(schema);
  if (objectSchema === undefined) {
    return coerceNonObjectHeaderContainer(header, schema);
  }
  return coerceObjectHeader(
    header,
    objectSchema.shape,
    preserveUnknownObjectKeys
  );
}

/**
 * Coerces query data to match schema expectations with case-sensitive
 * matching.
 */
export function coerceQueryToSchema(
  query: unknown,
  schema: HttpQuerySchema
): unknown {
  if (query === undefined && schema instanceof z.ZodOptional) {
    return undefined;
  }
  const objectSchema = getObjectSchema(schema);
  if (objectSchema === undefined) {
    const container = getContainerSchema(schema);
    if (container instanceof z.ZodRecord) {
      return coerceRecordToSchema(
        query ?? {},
        container.keyType,
        container.valueType,
        false
      );
    }
    return query ?? {};
  }
  return coerceToSchema(query ?? {}, objectSchema.shape, true, true);
}

function coerceNonObjectHeaderContainer(
  header: unknown,
  schema: HttpHeaderSchemaLike
): unknown {
  const container = getContainerSchema(schema);
  if (container instanceof z.ZodRecord) {
    return coerceRecordToSchema(
      header ?? {},
      container.keyType,
      container.valueType,
      true
    );
  }
  return header ?? {};
}

function coerceObjectHeader(
  header: unknown,
  shape: $ZodShape,
  preserveUnknownKeys: boolean
): unknown {
  if (typeof header !== "object" || header === null) {
    return coerceToSchema(header ?? {}, shape, false, preserveUnknownKeys);
  }
  if (Array.isArray(header)) {
    return header;
  }

  const preprocessed = splitCommaDelimitedValues(header, shape);
  return coerceToSchema(preprocessed, shape, false, preserveUnknownKeys);
}

/**
 * Coerces a record container with value-schema-aware cardinality.
 *
 * Query keys and non-finite header keys preserve their transport casing.
 * Finite header keys are restored to their single declared casing. When the
 * value schema expects an array, a singleton value is wrapped and, for
 * headers (`splitCommaDelimited`), a comma-delimited string is split into a
 * list. Scalar values keep their raw shape so Zod can reject multiplicity.
 */
function coerceRecordToSchema(
  data: unknown,
  keyType: z.core.$ZodType,
  valueType: z.core.$ZodType,
  splitCommaDelimited: boolean
): unknown {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data;
  }

  const expectsArray = isArraySchema(valueType);
  const coerced: Record<string, unknown | unknown[]> = Object.create(
    null
  ) as Record<string, unknown | unknown[]>;
  const record = data as Record<string, unknown>;

  for (const [key, value] of Object.entries(record)) {
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
function splitCommaDelimitedValues(
  header: object,
  shape: $ZodShape
): Record<string, unknown> {
  const schemaMap = analyzeSchema(shape, false);
  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;

  for (const [key, value] of Object.entries(header)) {
    const schemaInfo = schemaMap.get(key.toLowerCase());

    if (schemaInfo?.isArray && typeof value === "string") {
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
function addValueToCoerced(
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

  // Merge existing and new values
  const existingArray: unknown[] = Array.isArray(existing)
    ? existing
    : [existing];
  const newArray: unknown[] = Array.isArray(newValue) ? newValue : [newValue];
  const merged: unknown[] = [...existingArray, ...newArray];

  // If schema expects a single value but we have multiple, preserve as array
  // to avoid data loss (validation will catch this later)
  setOwnValue(
    coerced,
    key,
    expectsArray || merged.length > 1 ? merged : merged[0]
  );
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
function setOwnValue<TValue>(
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
  if (expectsArray && !Array.isArray(value)) {
    return [value];
  }
  if (!expectsArray && Array.isArray(value) && value.length === 1) {
    return value[0];
  }
  return value;
}

/**
 * Maps normalized (lowercase) keys back to their original casing as defined
 * in the schema. Used for case-insensitive matching where the output should
 * preserve schema-defined casing.
 */
function mapToOriginalKeys(
  coerced: Record<string, unknown | unknown[]>,
  schemaMap: Map<string, { readonly originalKey: string }>
): Record<string, unknown | unknown[]> {
  const withOriginalKeys: Record<string, unknown | unknown[]> = Object.create(
    null
  ) as Record<string, unknown | unknown[]>;
  for (const [key, value] of Object.entries(coerced)) {
    const originalKey = schemaMap.get(key)?.originalKey ?? key;
    setOwnValue(withOriginalKeys, originalKey, value);
  }
  return withOriginalKeys;
}
