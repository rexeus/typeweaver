import type { IHttpResponse, ITypedHttpResponse } from "./HttpResponse.js";
import type { ResponseValidationError } from "./ResponseValidationError.js";

type ValidationSuccessResult<T> = {
  readonly isValid: true;
  readonly data: T;
};

type ValidationFailureResult = {
  readonly isValid: false;
  readonly error: ResponseValidationError;
};

export type SafeResponseValidationResult<T> =
  | ValidationSuccessResult<T>
  | ValidationFailureResult;

/**
 * Interface for HTTP response validators.
 */
export type IResponseValidator<
  TResponse extends IHttpResponse | ITypedHttpResponse =
    | IHttpResponse
    | ITypedHttpResponse,
> = {
  /**
   * Validates a response and returns a result object.
   * Does not throw errors.
   */
  safeValidate(
    response: IHttpResponse
  ): SafeResponseValidationResult<TResponse>;
  /**
   * Validates a response and returns the validated response.
   * @throws {ResponseValidationError} If validation fails
   */
  validate(response: IHttpResponse): TResponse;
};
