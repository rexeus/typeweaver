import { z } from "zod";
import {
  addValueToCoerced,
  coerceRecordToSchema,
  createNullPrototypeRecord,
  mapToOriginalKeys,
  setOwnValue,
  splitCommaDelimitedValues,
} from "./validatorCoercionHelpers.js";
import {
  analyzeSchema,
  fieldExpectsArray,
  getContainerSchema,
  getObjectSchema,
} from "./validatorSchemaAnalysis.js";
export function findMultiplicityIssues(data, schema, caseSensitive) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  const issues = [];
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
export function coerceToSchema(data, shape, caseSensitive, preserveUnknownKeys) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data;
  }
  const schemaMap = analyzeSchema(shape, caseSensitive);
  const coerced = createNullPrototypeRecord();
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
export function coerceHeaderToSchema(header, schema, preserveUnknownObjectKeys = false) {
  if (header === undefined && schema instanceof z.ZodOptional) {
    return undefined;
  }
  const objectSchema = getObjectSchema(schema);
  if (objectSchema === undefined) {
    return coerceNonObjectHeaderContainer(header, schema);
  }
  return coerceObjectHeader(header, objectSchema.shape, preserveUnknownObjectKeys);
}
/**
 * Coerces query data to match schema expectations with case-sensitive
 * matching.
 */
export function coerceQueryToSchema(query, schema) {
  if (query === undefined && schema instanceof z.ZodOptional) {
    return undefined;
  }
  const objectSchema = getObjectSchema(schema);
  if (objectSchema === undefined) {
    const container = getContainerSchema(schema);
    if (container instanceof z.ZodRecord) {
      return coerceRecordToSchema(query ?? {}, container.keyType, container.valueType, false);
    }
    return query ?? {};
  }
  return coerceToSchema(query ?? {}, objectSchema.shape, true, true);
}
function coerceNonObjectHeaderContainer(header, schema) {
  const container = getContainerSchema(schema);
  if (container instanceof z.ZodRecord) {
    return coerceRecordToSchema(header ?? {}, container.keyType, container.valueType, true);
  }
  return header ?? {};
}
function coerceObjectHeader(header, shape, preserveUnknownKeys) {
  if (typeof header !== "object" || header === null) {
    return coerceToSchema(header ?? {}, shape, false, preserveUnknownKeys);
  }
  if (Array.isArray(header)) {
    return header;
  }
  const preprocessed = splitCommaDelimitedValues(header, shape);
  return coerceToSchema(preprocessed, shape, false, preserveUnknownKeys);
}
