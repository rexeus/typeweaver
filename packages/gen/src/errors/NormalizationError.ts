import {
  ContradictorySecurityHeaderError,
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  DuplicateResponseNameError,
  DuplicateRouteError,
  DuplicateSecuritySchemeNameError,
  DuplicateTagNameError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidApiMetadataError,
  InvalidDerivedResponseError,
  InvalidOperationIdError,
  InvalidRequestSchemaError,
  InvalidResourceNameError,
  InvalidSecurityRequirementError,
  InvalidSecuritySchemeError,
  MissingDerivedResponseParentError,
  PathParameterMismatchError,
  UnknownSecuritySchemeError,
  UnknownTagError,
} from "./index.js";

/**
 * Tagged union of every error the spec normalizer may raise. Every variant
 * is a `Data.TaggedError` instance, so callers can address each
 * one via `Effect.catchTag` / `Effect.catchTags`.
 *
 * `DuplicateResponseNameError` is the normalizer-side tagged counterpart
 * of the plain core error thrown by `validateUniqueResponseNames` — the
 * normalizer wraps the core error at its boundary so this union stays
 * homogeneous.
 */
export type NormalizationError =
  | ContradictorySecurityHeaderError
  | DerivedResponseCycleError
  | DuplicateOperationIdError
  | DuplicateResponseNameError
  | DuplicateRouteError
  | DuplicateSecuritySchemeNameError
  | DuplicateTagNameError
  | EmptyOperationResponsesError
  | EmptyResourceOperationsError
  | EmptySpecResourcesError
  | InvalidApiMetadataError
  | InvalidDerivedResponseError
  | InvalidOperationIdError
  | InvalidRequestSchemaError
  | InvalidResourceNameError
  | InvalidSecurityRequirementError
  | InvalidSecuritySchemeError
  | MissingDerivedResponseParentError
  | PathParameterMismatchError
  | UnknownSecuritySchemeError
  | UnknownTagError;

type NormalizationErrorConstructor = abstract new (
  ...args: never[]
) => NormalizationError;

const normalizationErrorConstructors: readonly NormalizationErrorConstructor[] =
  [
    ContradictorySecurityHeaderError,
    DerivedResponseCycleError,
    DuplicateOperationIdError,
    DuplicateResponseNameError,
    DuplicateRouteError,
    DuplicateSecuritySchemeNameError,
    DuplicateTagNameError,
    EmptyOperationResponsesError,
    EmptyResourceOperationsError,
    EmptySpecResourcesError,
    InvalidApiMetadataError,
    InvalidDerivedResponseError,
    InvalidOperationIdError,
    InvalidRequestSchemaError,
    InvalidResourceNameError,
    InvalidSecurityRequirementError,
    InvalidSecuritySchemeError,
    MissingDerivedResponseParentError,
    PathParameterMismatchError,
    UnknownSecuritySchemeError,
    UnknownTagError,
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
