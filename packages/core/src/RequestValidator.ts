import type {
  IHttpRequest,
  IRawHttpRequest,
  IValidatedHttpRequest,
} from "./HttpRequest.js";
import type { RequestValidationError } from "./RequestValidationError.js";

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

export type IRequestValidator<
  TValidatedRequest extends IValidatedHttpRequest = IHttpRequest,
> = {
  /**
   * Validates a request and returns a result object.
   * Does not throw errors.
   */
  safeValidate(
    request: IRawHttpRequest
  ): SafeRequestValidationResult<TValidatedRequest>;
  /**
   * Validates a request and returns the validated request.
   * @throws {RequestValidationError} If validation fails
   */
  validate(request: IRawHttpRequest): TValidatedRequest;
};
