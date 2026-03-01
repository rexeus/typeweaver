import { Validator } from "./Validator";
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
export class ResponseValidator extends Validator {
  /**
   * Generic response validation method that validates header and body schemas.
   * This method reduces code duplication across individual response validators.
   *
   * @param responseName - Name of the response type for error reporting
   * @param headerSchema - Zod schema for header validation (optional)
   * @param bodySchema - Zod schema for body validation (optional)
   * @returns Function that validates response and returns result
   */
  validateResponseType(responseName, headerSchema, bodySchema) {
    return (response, error) => {
      let isValid = true;
      const validatedResponse = {
        statusCode: response.statusCode,
        header: undefined,
        body: undefined,
      };
      if (bodySchema) {
        const validateBodyResult = bodySchema.safeParse(response.body);
        if (!validateBodyResult.success) {
          error.addBodyIssues(responseName, validateBodyResult.error.issues);
          isValid = false;
        } else {
          validatedResponse.body = validateBodyResult.data;
        }
      }
      if (headerSchema) {
        const coercedHeader = this.coerceHeaderToSchema(
          response.header,
          this.getSchema(headerSchema),
        );
        const validateHeaderResult = headerSchema.safeParse(coercedHeader);
        if (!validateHeaderResult.success) {
          error.addHeaderIssues(responseName, validateHeaderResult.error.issues);
          isValid = false;
        } else {
          validatedResponse.header = validateHeaderResult.data;
        }
      }
      if (!isValid) {
        return {
          isValid: false,
          error,
        };
      }
      return {
        isValid: true,
        data: validatedResponse,
      };
    };
  }
}
