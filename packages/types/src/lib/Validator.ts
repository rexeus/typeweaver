import { $ZodArray, $ZodOptional, type $ZodShape } from "zod/v4/core";

/**
 * Abstract base class for HTTP validation.
 *
 * This class provides the foundation for request and response validators that:
 * - Analyze Zod schemas for correct single/multi value handling of headers and query parameters
 * - Coerce objects to match schema expectations
 */
export abstract class Validator {
  /**
   * Analyzes a Zod schema shape to create an efficient lookup map.
   *
   * @param shape - The Zod schema shape to analyze
   * @param caseSensitive - Whether to preserve key casing (true) or normalize to lowercase (false)
   * @returns Map with lookup keys pointing to original key and array type information
   */
  protected analyzeSchema(
    shape: $ZodShape,
    caseSensitive: boolean
  ): Map<string, { originalKey: string; isArray: boolean }> {
    const schemaMap = new Map<
      string,
      { originalKey: string; isArray: boolean }
    >();
    for (const [key, zodType] of Object.entries(shape)) {
      const isArray =
        zodType instanceof $ZodArray ||
        (zodType instanceof $ZodOptional &&
          zodType._zod.def.innerType instanceof $ZodArray);

      const lookupKey = caseSensitive ? key : key.toLowerCase();
      schemaMap.set(lookupKey, { originalKey: key, isArray });
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
  protected coerceToSchema(
    data: unknown,
    shape: $ZodShape,
    caseSensitive: boolean
  ): unknown {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const schemaMap = this.analyzeSchema(shape, caseSensitive);
    const coerced: Record<string, string | string[]> = {};

    for (const [key, value] of Object.entries(data)) {
      const lookupKey = caseSensitive ? key : key.toLowerCase();
      const schemaInfo = schemaMap.get(lookupKey);

      if (schemaInfo) {
        const { originalKey, isArray } = schemaInfo;
        if (isArray && !Array.isArray(value)) {
          coerced[originalKey] = [value];
        } else {
          coerced[originalKey] = value;
        }
      }
      // Headers/params not in schema are ignored (strict validation)
    }

    return coerced;
  }

  /**
   * Coerces header data to match schema expectations with case-insensitive matching.
   *
   * @param header - The header object to coerce
   * @param shape - The Zod schema shape for headers
   * @returns Coerced header object
   */
  protected coerceHeaderToSchema(header: unknown, shape: $ZodShape): unknown {
    return this.coerceToSchema(header, shape, false); // case-insensitive
  }

  /**
   * Coerces query data to match schema expectations with case-sensitive matching.
   *
   * @param query - The query object to coerce
   * @param shape - The Zod schema shape for query parameters
   * @returns Coerced query object
   */
  protected coerceQueryToSchema(query: unknown, shape: $ZodShape): unknown {
    return this.coerceToSchema(query, shape, true); // case-sensitive
  }
}
