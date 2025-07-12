import type { IHttpResponse } from "./HttpResponse";
import type { ResponseValidationError } from "./ResponseValidationError";

type ValidationSuccessResult<T> = {
  isValid: true;
  data: T;
};

type ValidationFailureResult = {
  isValid: false;
  error: ResponseValidationError;
};

export type SafeResponseValidationResult<T> =
  | ValidationSuccessResult<T>
  | ValidationFailureResult;

/**
 * Interface for HTTP response validators.
 */
export type IResponseValidator = {
  /**
   * Validates a response and returns a result object.
   * Does not throw errors.
   */
  safeValidate(
    response: IHttpResponse
  ): SafeResponseValidationResult<IHttpResponse>;
  /**
   * Validates a response and returns the validated response.
   * @throws {ResponseValidationError} If validation fails
   */
  validate(response: IHttpResponse): IHttpResponse;
};
