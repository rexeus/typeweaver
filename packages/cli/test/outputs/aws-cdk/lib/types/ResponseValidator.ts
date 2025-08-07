import type {
  IHttpResponse,
  IResponseValidator,
  SafeResponseValidationResult,
} from "@rexeus/typeweaver-core";
import { $ZodArray, $ZodOptional, type $ZodShape } from "zod/v4/core";

/**
 * Abstract base class for HTTP response validation.
 *
 * This class provides the foundation for response validators that:
 * - Validate response status codes match expected values
 * - Validate response headers and body against schemas
 * - Support both safe (non-throwing) and unsafe (throwing) validation
 * - Integrate with Zod schemas for runtime validation
 *
 * Response validators are typically used in API clients to ensure
 * responses match the expected format before processing.
 */
export abstract class ResponseValidator implements IResponseValidator {
  /**
   * Validates a response without throwing errors.
   *
   * @param response - The HTTP response to validate
   * @returns A result object containing either the validated response or error details
   */
  public abstract safeValidate(
    response: IHttpResponse,
  ): SafeResponseValidationResult<IHttpResponse>;

  /**
   * Validates a response and throws if validation fails.
   *
   * @param response - The HTTP response to validate
   * @returns The validated response with proper typing
   * @throws {InvalidResponseStatusCodeError} If status code doesn't match expected
   * @throws {ResponseValidationError} If response structure fails validation
   */
  public abstract validate(response: IHttpResponse): IHttpResponse;

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
}
