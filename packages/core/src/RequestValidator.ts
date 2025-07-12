import type { IHttpRequest } from "./HttpRequest";
import type { RequestValidationError } from "./RequestValidationError";

type ValidationSuccessResult<T> = {
  isValid: true;
  data: T;
};

type ValidationFailureResult = {
  isValid: false;
  error: RequestValidationError;
};

export type SafeRequestValidationResult<T> =
  | ValidationSuccessResult<T>
  | ValidationFailureResult;

/**
 * Interface for HTTP request validators.
 */
export type IRequestValidator = {
  /**
   * Validates a request and returns a result object.
   * Does not throw errors.
   */
  safeValidate(
    request: IHttpRequest
  ): SafeRequestValidationResult<IHttpRequest>;
  /**
   * Validates a request and returns the validated request.
   * @throws {RequestValidationError} If validation fails
   */
  validate(request: IHttpRequest): IHttpRequest;
};
