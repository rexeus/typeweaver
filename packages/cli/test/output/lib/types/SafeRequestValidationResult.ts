import { RequestValidationError } from "./RequestValidationError";

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
