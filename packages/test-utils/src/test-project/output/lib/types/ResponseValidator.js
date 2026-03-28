import { ResponseValidationError } from "@rexeus/typeweaver-core";
import { Validator } from "./Validator";
/**
 * Abstract base class for HTTP response validation.
 *
 * Subclasses provide response metadata via `responseEntries` and
 * `expectedStatusCodes`. All validation logic lives here.
 */
export class ResponseValidator extends Validator {
  safeValidate(response) {
    const error = new ResponseValidationError(response.statusCode);
    for (const entry of this.responseEntries) {
      if (response.statusCode === entry.statusCode) {
        const result = this.validateResponseType(
          entry.name,
          entry.headerSchema,
          entry.bodySchema,
        )(response, error);
        if (result.isValid) return result;
      }
    }
    if (!error.hasResponseIssues()) {
      error.addStatusCodeIssue([...this.expectedStatusCodes]);
    }
    return {
      isValid: false,
      error,
    };
  }
  validate(response) {
    const result = this.safeValidate(response);
    if (!result.isValid) throw result.error;
    return result.data;
  }
  validateResponseType(responseName, headerSchema, bodySchema) {
    return (response, error) => {
      let isValid = true;
      const validatedResponse = {
        type: responseName,
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
