import { Validator } from "./Validator";
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
export class RequestValidator extends Validator {
  constructor() {
    super();
  }
}
