import type { IHttpResponse } from "../definition";

/**
 * Error thrown when an HTTP response has an unexpected status code.
 *
 * This error is typically thrown during response validation when the
 * actual status code doesn't match any of the expected status codes
 * defined in the operation specification.
 *
 * The error includes the complete response for debugging and error handling.
 */
export class InvalidResponseStatusCodeError extends Error {
  /**
   * Creates a new InvalidResponseStatusCodeError.
   *
   * @param response - The HTTP response with unexpected status code
   */
  constructor(public response: IHttpResponse) {
    super("Invalid response status code");
  }
}
