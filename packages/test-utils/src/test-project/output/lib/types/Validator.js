import z from "zod";
import { $ZodArray, $ZodOptional } from "zod/v4/core";
/**
 * Abstract base class for HTTP validation.
 *
 * This class provides the foundation for request and response validators that:
 * - Analyze Zod schemas for correct single/multi value handling of headers and query parameters
 * - Coerce objects to match schema expectations
 */
export class Validator {
  static schemaCacheCaseSensitive = new WeakMap();
  static schemaCacheCaseInsensitive = new WeakMap();
  /**
   * Analyzes a Zod schema shape to create an efficient lookup map.
   * Results are cached using WeakMap for optimal performance.
   *
   * @param shape - The Zod schema shape to analyze
   * @param caseSensitive - Whether to preserve key casing (true) or normalize to lowercase (false)
   * @returns Map with lookup keys pointing to original key and array type information
   */
  analyzeSchema(shape, caseSensitive) {
    const cache = caseSensitive
      ? Validator.schemaCacheCaseSensitive
      : Validator.schemaCacheCaseInsensitive;
    const cached = cache.get(shape);
    if (cached) {
      return cached;
    }
    const schemaMap = this.buildSchemaMap(shape, caseSensitive);
    cache.set(shape, schemaMap);
    return schemaMap;
  }
  /**
   *
   * Extracts a Zod schema shape from header or query schemas.
   * This is used to support schema coercion and analysis.
   *
   * @param headerSchema
   * @returns
   */
  getSchema(headerSchema) {
    if (headerSchema instanceof z.ZodObject) {
      return headerSchema.shape;
    }
    if (headerSchema instanceof z.ZodOptional) {
      const unwrapped = headerSchema.unwrap();
      if (unwrapped instanceof z.ZodObject) {
        return unwrapped.shape;
      }
    }
    return {};
  }
  /**
   * Builds a schema map by analyzing the Zod shape structure.
   * Extracts type information for each field to support proper coercion.
   */
  buildSchemaMap(shape, caseSensitive) {
    const schemaMap = new Map();
    for (const [key, zodType] of Object.entries(shape)) {
      if (!zodType) continue;
      const isArray =
        zodType instanceof $ZodArray ||
        (zodType instanceof $ZodOptional && zodType._zod.def.innerType instanceof $ZodArray);
      const lookupKey = caseSensitive ? key : key.toLowerCase();
      schemaMap.set(lookupKey, {
        originalKey: key,
        isArray,
      });
    }
    return schemaMap;
  }
  /**
   * Coerces objects to match schema expectations with configurable case sensitivity.
   * Values not in the schema are ignored.
   *
   * @param data - The data object to coerce
   * @param shape - The Zod schema shape to match against
   * @param caseSensitive - Whether keys should match exactly (true) or case-insensitively (false)
   * @returns Coerced data object with proper key casing and array coercion
   */
  coerceToSchema(data, shape, caseSensitive) {
    if (typeof data !== "object" || data === null) {
      return data;
    }
    const schemaMap = this.analyzeSchema(shape, caseSensitive);
    const coerced = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = caseSensitive ? key : key.toLowerCase();
      const schemaInfo = schemaMap.get(normalizedKey);
      if (schemaInfo) {
        this.addValueToCoerced(coerced, normalizedKey, value, schemaInfo.isArray);
      }
    }
    // If case-sensitive, return coerced object as is
    if (caseSensitive) {
      return coerced;
    }
    // If case-insensitive, map back to original keys from schema
    return this.mapToOriginalKeys(coerced, schemaMap);
  }
  /**
   * Adds a value to the coerced object, handling collisions when multiple
   * values exist for the same key (e.g., duplicate headers with different casing).
   * Preserves all values as arrays when collisions occur to prevent data loss.
   */
  addValueToCoerced(coerced, key, value, expectsArray) {
    const existing = coerced[key];
    const newValue = this.coerceValueStructure(value, expectsArray);
    if (existing === undefined) {
      coerced[key] = newValue;
      return;
    }
    // Merge existing and new values
    const existingArray = Array.isArray(existing) ? existing : [existing];
    const newArray = Array.isArray(newValue) ? newValue : [newValue];
    const merged = [...existingArray, ...newArray];
    // If schema expects a single value but we have multiple, preserve as array
    // to avoid data loss (validation will catch this later)
    coerced[key] = expectsArray || merged.length > 1 ? merged : merged[0];
  }
  /**
   * Coerces a value's structure to match schema expectations.
   * Wraps single values in arrays when schema expects array type,
   * unwraps single-element arrays when schema expects single value.
   */
  coerceValueStructure(value, expectsArray) {
    if (expectsArray && !Array.isArray(value)) {
      return [value];
    }
    if (!expectsArray && Array.isArray(value) && value.length === 1) {
      return value[0];
    }
    return value;
  }
  /**
   * Maps normalized (lowercase) keys back to their original casing as defined in the schema.
   * Used for case-insensitive matching where the output should preserve schema-defined casing.
   */
  mapToOriginalKeys(coerced, schemaMap) {
    const withOriginalKeys = {};
    for (const [key, value] of Object.entries(coerced)) {
      const originalKey = schemaMap.get(key)?.originalKey ?? key;
      withOriginalKeys[originalKey] = value;
    }
    return withOriginalKeys;
  }
  /**
   * Coerces header data to match schema expectations with case-insensitive matching.
   *
   * @param header - The header object to coerce
   * @param shape - The Zod schema shape for headers
   * @returns Coerced header object
   */
  coerceHeaderToSchema(header, shape) {
    if (typeof header !== "object" || header === null) {
      return this.coerceToSchema(header ?? {}, shape, false);
    }
    const preprocessed = this.splitCommaDelimitedValues(header, shape);
    return this.coerceToSchema(preprocessed, shape, false);
  }
  /**
   * Splits comma-separated header strings into arrays per RFC 7230.
   * Only applies to fields where the schema expects an array type.
   * Values that are already arrays pass through unchanged.
   */
  splitCommaDelimitedValues(header, shape) {
    const schemaMap = this.analyzeSchema(shape, false);
    const result = {};
    for (const [key, value] of Object.entries(header)) {
      const schemaInfo = schemaMap.get(key.toLowerCase());
      if (schemaInfo?.isArray && typeof value === "string") {
        result[key] = value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v !== "");
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  /**
   * Coerces query data to match schema expectations with case-sensitive matching.
   *
   * @param query - The query object to coerce
   * @param shape - The Zod schema shape for query parameters
   * @returns Coerced query object
   */
  coerceQueryToSchema(query, shape) {
    return this.coerceToSchema(query ?? {}, shape, true);
  }
}
