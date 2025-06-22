import { ResponseValidationError } from "./ResponseValidationError";

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
