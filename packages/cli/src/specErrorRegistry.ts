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

export type SpecErrorEntry = {
  readonly code: string;
  readonly summary: string;
  readonly hint: string;
};

export type SpecErrorRegistryEntry = SpecErrorEntry & {
  readonly errorClass: new (...args: never[]) => Error;
};

export const SPEC_ERROR_ENTRIES: readonly SpecErrorRegistryEntry[] = [
  {
    errorClass: DuplicateOperationIdError,
    code: "TW-SPEC-002",
    summary: "Operation IDs must be globally unique.",
    hint: "Rename one of the duplicated operation IDs so every operation is unique across the spec.",
  },
  {
    errorClass: DuplicateRouteError,
    code: "TW-SPEC-003",
    summary: "Two operations resolve to the same route.",
    hint: "Change the route path or HTTP method so the normalized route is unique.",
  },
  {
    errorClass: EmptySpecResourcesError,
    code: "TW-SPEC-004",
    summary: "The spec does not define any resources.",
    hint: "Declare at least one resource before generating or validating.",
  },
  {
    errorClass: EmptyResourceOperationsError,
    code: "TW-SPEC-005",
    summary: "A resource is missing operations.",
    hint: "Every resource needs at least one operation.",
  },
  {
    errorClass: EmptyOperationResponsesError,
    code: "TW-SPEC-006",
    summary: "An operation is missing responses.",
    hint: "Declare at least one response for every operation.",
  },
  {
    errorClass: InvalidOperationIdError,
    code: "TW-SPEC-007",
    summary: "An operation ID uses an unsupported naming style.",
    hint: "Use camelCase or PascalCase for operation IDs.",
  },
  {
    errorClass: InvalidResourceNameError,
    code: "TW-SPEC-008",
    summary: "A resource name uses an unsupported naming style.",
    hint: "Use camelCase (singular) or PascalCase for resource names.",
  },
  {
    errorClass: InvalidRequestSchemaError,
    code: "TW-SPEC-009",
    summary: "An operation request schema is invalid.",
    hint: "Every request section must be a supported schema definition.",
  },
  {
    errorClass: PathParameterMismatchError,
    code: "TW-SPEC-010",
    summary:
      "An operation path does not match its declared request parameters.",
    hint: "Every path placeholder must be declared in request.param, and no extras may remain.",
  },
  {
    errorClass: InvalidDerivedResponseError,
    code: "TW-SPEC-011",
    summary: "A derived response definition is invalid.",
    hint: "Check derived-response lineage and ensure it points to a valid canonical response.",
  },
  {
    errorClass: MissingDerivedResponseParentError,
    code: "TW-SPEC-012",
    summary: "A derived response references a missing parent.",
    hint: "Define the canonical parent response or update the derived response to reference an existing parent.",
  },
  {
    errorClass: DerivedResponseCycleError,
    code: "TW-SPEC-013",
    summary: "A derived response contains a cycle.",
    hint: "Break the response inheritance cycle so every derived response has an acyclic lineage.",
  },
];

export const SPEC_LOAD_FAILURE_CODE = "TW-SPEC-001";

export const lookupSpecErrorEntry = (
  error: unknown
): SpecErrorEntry | undefined => {
  return SPEC_ERROR_ENTRIES.find(entry => error instanceof entry.errorClass);
};
