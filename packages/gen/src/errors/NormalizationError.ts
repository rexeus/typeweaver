import {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  DuplicateResponseNameError,
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
 * Tagged union of every error the spec normalizer may raise. All 13
 * variants are `Data.TaggedError` instances, so callers can address each
 * one via `Effect.catchTag` / `Effect.catchTags`.
 *
 * `DuplicateResponseNameError` is the normalizer-side tagged counterpart
 * of the plain core error thrown by `validateUniqueResponseNames` — the
 * normalizer wraps the core error at its boundary so this union stays
 * homogeneous.
 */
export type NormalizationError =
  | DerivedResponseCycleError
  | DuplicateOperationIdError
  | DuplicateResponseNameError
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

/**
 * Predicate that recognises every error the normalizer is allowed to surface.
 * Lets `Effect.try` catch handlers narrow safely instead of casting blindly.
 */
export const isNormalizationError = (
  error: unknown
): error is NormalizationError =>
  error instanceof DerivedResponseCycleError ||
  error instanceof DuplicateOperationIdError ||
  error instanceof DuplicateResponseNameError ||
  error instanceof DuplicateRouteError ||
  error instanceof EmptyOperationResponsesError ||
  error instanceof EmptyResourceOperationsError ||
  error instanceof EmptySpecResourcesError ||
  error instanceof InvalidDerivedResponseError ||
  error instanceof InvalidOperationIdError ||
  error instanceof InvalidRequestSchemaError ||
  error instanceof InvalidResourceNameError ||
  error instanceof MissingDerivedResponseParentError ||
  error instanceof PathParameterMismatchError;
