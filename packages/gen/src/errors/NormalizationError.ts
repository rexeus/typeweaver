import type {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  DuplicateRouteError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidDerivedResponseError,
  InvalidOperationIdError,
  InvalidRequestSchemaError,
  InvalidResourceNameError,
  MissingDerivedResponseParentError,
  PathParameterMismatchError,
} from "./index.js";

/**
 * Tagged union of every error the spec normalizer may raise.
 * Use `Effect.catchTag` / `Effect.catchTags` to handle specific failures.
 */
export type NormalizationError =
  | DerivedResponseCycleError
  | DuplicateOperationIdError
  | DuplicateRouteError
  | EmptyOperationResponsesError
  | EmptyResourceOperationsError
  | EmptySpecResourcesError
  | InvalidDerivedResponseError
  | InvalidOperationIdError
  | InvalidRequestSchemaError
  | InvalidResourceNameError
  | MissingDerivedResponseParentError
  | PathParameterMismatchError;
