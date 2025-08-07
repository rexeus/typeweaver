import type {
  IHttpRequest,
  IRequestValidator,
  SafeRequestValidationResult,
} from "@rexeus/typeweaver-core";
import { $ZodArray, $ZodOptional, type $ZodShape } from "zod/v4/core";

/**
 * Abstract base class for HTTP request validation.
 *
 * This class provides the foundation for request validators that:
 * - Validate headers, body, query parameters, and path parameters
 * - Support both safe (non-throwing) and unsafe (throwing) validation
 * - Integrate with Zod schemas for runtime validation
 * - Provide detailed error information for debugging
 *
 * Implementations should validate all request components and either:
 * - Return validated data (for `validate`)
 * - Return success/error result (for `safeValidate`)
 */
export abstract class RequestValidator implements IRequestValidator {
  public constructor() {
    //
  }

  /**
   * Validates a request without throwing errors.
   *
   * @param request - The HTTP request to validate
   * @returns A result object containing either the validated request or error details
   */
  public abstract safeValidate(
    request: IHttpRequest
  ): SafeRequestValidationResult<IHttpRequest>;

  /**
   * Validates a request and throws if validation fails.
   *
   * @param request - The HTTP request to validate
   * @returns The validated request with proper typing
   * @throws {RequestValidationError} If any part of the request fails validation
   */
  public abstract validate(request: IHttpRequest): IHttpRequest;

  protected coerceHeaderToSchema(header: unknown, shape: $ZodShape): unknown {
    if (typeof header !== "object" || header === null) {
      return header;
    }

    const coercedHeader: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(header)) {
      const zodType = shape[key];

      if (
        (zodType instanceof $ZodArray ||
          (zodType instanceof $ZodOptional &&
            zodType._zod.def.innerType instanceof $ZodArray)) &&
        !Array.isArray(value)
      ) {
        coercedHeader[key] = [value];
      } else {
        coercedHeader[key] = value;
      }
    }

    return coercedHeader;
  }

  protected coerceQueryToSchema(query: unknown, shape: $ZodShape): unknown {
    if (typeof query !== "object" || query === null) {
      return query;
    }

    const coercedQuery: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(query)) {
      const zodType = shape[key];

      if (
        (zodType instanceof $ZodArray ||
          (zodType instanceof $ZodOptional &&
            zodType._zod.def.innerType instanceof $ZodArray)) &&
        !Array.isArray(value)
      ) {
        coercedQuery[key] = [value];
      } else {
        coercedQuery[key] = value;
      }
    }

    return coercedQuery;
  }
}
