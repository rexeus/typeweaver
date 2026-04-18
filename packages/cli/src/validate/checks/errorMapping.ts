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
} from "@rexeus/typeweaver-gen";
import type { Issue } from "../types.js";

/**
 * Map a known spec-loading error to a structured validation issue.
 *
 * The intent is to give CI and LSP consumers stable codes. Any error type not
 * recognised here collapses to the umbrella `TW-SPEC-001`, which guarantees
 * forward compatibility for new normalize errors.
 */
export const mapSpecErrorToIssue = (error: unknown): Issue => {
  if (error instanceof DuplicateOperationIdError) {
    return {
      code: "TW-SPEC-002",
      severity: "error",
      message: error.message,
      hint: "Rename one of the duplicated operation IDs so every operation is globally unique.",
    };
  }

  if (error instanceof DuplicateRouteError) {
    return {
      code: "TW-SPEC-003",
      severity: "error",
      message: error.message,
      hint: "Change the route path or HTTP method so the normalized route is unique.",
    };
  }

  if (error instanceof EmptySpecResourcesError) {
    return {
      code: "TW-SPEC-004",
      severity: "error",
      message: error.message,
      hint: "Declare at least one resource before validating.",
    };
  }

  if (error instanceof EmptyResourceOperationsError) {
    return {
      code: "TW-SPEC-005",
      severity: "error",
      message: error.message,
      hint: "Every resource needs at least one operation.",
    };
  }

  if (error instanceof EmptyOperationResponsesError) {
    return {
      code: "TW-SPEC-006",
      severity: "error",
      message: error.message,
      hint: "Declare at least one response for every operation.",
    };
  }

  if (error instanceof InvalidOperationIdError) {
    return {
      code: "TW-SPEC-007",
      severity: "error",
      message: error.message,
      hint: "Use camelCase or PascalCase for operation IDs.",
    };
  }

  if (error instanceof InvalidResourceNameError) {
    return {
      code: "TW-SPEC-008",
      severity: "error",
      message: error.message,
      hint: "Use camelCase (singular) or PascalCase for resource names.",
    };
  }

  if (error instanceof InvalidRequestSchemaError) {
    return {
      code: "TW-SPEC-009",
      severity: "error",
      message: error.message,
      hint: "Every request section must be a supported schema definition.",
    };
  }

  if (error instanceof PathParameterMismatchError) {
    return {
      code: "TW-SPEC-010",
      severity: "error",
      message: error.message,
      hint: "Every path placeholder must be declared in request.param, and no extras may remain.",
    };
  }

  if (error instanceof InvalidDerivedResponseError) {
    return {
      code: "TW-SPEC-011",
      severity: "error",
      message: error.message,
      hint: "Check derived-response lineage and ensure it points to a valid canonical response.",
    };
  }

  if (error instanceof MissingDerivedResponseParentError) {
    return {
      code: "TW-SPEC-012",
      severity: "error",
      message: error.message,
      hint: "Define the canonical parent response or update the derived response to reference an existing parent.",
    };
  }

  if (error instanceof DerivedResponseCycleError) {
    return {
      code: "TW-SPEC-013",
      severity: "error",
      message: error.message,
      hint: "Break the response inheritance cycle so every derived response has an acyclic lineage.",
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    code: "TW-SPEC-001",
    severity: "error",
    message,
    hint: "Fix the underlying spec-loading error. Run with --verbose for the full trace.",
  };
};
