import { DuplicateResponseNameError } from "@rexeus/typeweaver-core";
import {
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
 *
 * Includes `DuplicateResponseNameError` from `@rexeus/typeweaver-core` —
 * thrown by `validateUniqueResponseNames` during normalization. It is a
 * plain `Error` (part of the public Zod-facing API surface), so callers
 * narrowing via `Effect.catchTag` can address the 12 tagged variants and
 * must use `Effect.catchAll` / `Effect.catchIf` for this one.
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
