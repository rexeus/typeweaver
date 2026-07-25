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

type NormalizationErrorConstructor = abstract new (
  ...args: never[]
) => NormalizationError;

const normalizationErrorConstructors: readonly NormalizationErrorConstructor[] =
  [
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
  ];

/**
 * Predicate that recognises every error the normalizer is allowed to surface.
 * Lets `Effect.try` catch handlers narrow safely instead of casting blindly.
 */
export const isNormalizationError = (
  error: unknown
): error is NormalizationError =>
  normalizationErrorConstructors.some(
    ErrorConstructor => error instanceof ErrorConstructor
  );
