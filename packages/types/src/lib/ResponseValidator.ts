import type { SafeResponseValidationResult } from "./SafeResponseValidationResult";
import type { IHttpResponse } from "@rexeus/typeweaver-core";

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
export abstract class ResponseValidator {
  /**
   * Validates a response without throwing errors.
   *
   * @param response - The HTTP response to validate
   * @returns A result object containing either the validated response or error details
   */
  public abstract safeValidate(
    response: IHttpResponse
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
}
