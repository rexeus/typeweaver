import { isNormalizationError } from "../errors/NormalizationError.js";
import type { NormalizationError } from "../errors/NormalizationError.js";
import type {
  NormalizedSpec,
  NormalizedSpecWarning,
  NormalizedSpecWarningLocation,
} from "../NormalizedSpec.js";
import type { Issue, JsonPointer } from "./Issue.js";

type NormalizationErrorTag = NormalizationError["_tag"];

export type SpecIssueEntry = {
  readonly code: `TW-SPEC-${string}`;
  readonly summary: string;
  readonly hint: string;
};

/**
 * Stable normalization-error codes. Entries are append-only: never reuse a
 * code for a different error tag. The `satisfies` clause makes a new
 * `NormalizationError` variant fail typechecking until it receives an entry.
 */
export const SPEC_ISSUE_REGISTRY = {
  ContradictorySecurityHeaderError: {
    code: "TW-SPEC-001",
    summary: "Security conflicts with an Authorization header schema",
    hint: "Align the Authorization header schema with the effective HTTP security scheme.",
  },
  DerivedResponseCycleError: {
    code: "TW-SPEC-002",
    summary: "Derived response lineage contains a cycle",
    hint: "Make every derived-response lineage terminate at one canonical response.",
  },
  DuplicateOperationIdError: {
    code: "TW-SPEC-003",
    summary: "Operation identifier is duplicated",
    hint: "Assign a globally unique operationId to every operation.",
  },
  DuplicateResponseNameError: {
    code: "TW-SPEC-004",
    summary: "Response name is duplicated",
    hint: "Assign a globally unique name to every response.",
  },
  DuplicateRouteError: {
    code: "TW-SPEC-005",
    summary: "Normalized HTTP route is duplicated",
    hint: "Change the method or path so every normalized route is unique.",
  },
  DuplicateSecuritySchemeNameError: {
    code: "TW-SPEC-006",
    summary: "Security scheme name is duplicated",
    hint: "Give every security scheme a unique name.",
  },
  DuplicateTagNameError: {
    code: "TW-SPEC-007",
    summary: "API tag name is duplicated",
    hint: "Declare each reusable API tag once.",
  },
  EmptyOperationResponsesError: {
    code: "TW-SPEC-008",
    summary: "Operation has no response",
    hint: "Declare at least one response for the operation.",
  },
  EmptyResourceOperationsError: {
    code: "TW-SPEC-009",
    summary: "Resource has no operation",
    hint: "Declare at least one operation for the resource.",
  },
  EmptySpecResourcesError: {
    code: "TW-SPEC-010",
    summary: "Spec has no resource",
    hint: "Declare at least one resource in the spec.",
  },
  InvalidApiMetadataError: {
    code: "TW-SPEC-011",
    summary: "API metadata is invalid",
    hint: "Provide non-empty API metadata and unique reusable tags.",
  },
  InvalidDerivedResponseError: {
    code: "TW-SPEC-012",
    summary: "Derived response metadata is invalid",
    hint: "Declare a valid canonical parent and lineage for the derived response.",
  },
  InvalidOperationIdError: {
    code: "TW-SPEC-013",
    summary: "Operation identifier is invalid",
    hint: "Use a camelCase or PascalCase operationId.",
  },
  InvalidRequestSchemaError: {
    code: "TW-SPEC-014",
    summary: "Request schema is invalid",
    hint: "Use a supported Zod schema for the affected request part.",
  },
  InvalidResourceNameError: {
    code: "TW-SPEC-015",
    summary: "Resource name is invalid",
    hint: "Use a singular camelCase or PascalCase resource name.",
  },
  InvalidSecurityRequirementError: {
    code: "TW-SPEC-016",
    summary: "Security requirement is invalid",
    hint: "Reference declared schemes and only scopes supported by those schemes.",
  },
  InvalidSecuritySchemeError: {
    code: "TW-SPEC-017",
    summary: "Security scheme is invalid",
    hint: "Complete the required fields for the selected security scheme kind.",
  },
  MissingDerivedResponseParentError: {
    code: "TW-SPEC-018",
    summary: "Derived response parent is missing",
    hint: "Reference an existing canonical response as the parent.",
  },
  PathParameterMismatchError: {
    code: "TW-SPEC-019",
    summary: "Path parameters and request parameters differ",
    hint: "Declare exactly the path parameters named by the route.",
  },
  UnknownSecuritySchemeError: {
    code: "TW-SPEC-020",
    summary: "Security requirement references an unknown scheme",
    hint: "Declare the scheme or correct the requirement name.",
  },
  UnknownTagError: {
    code: "TW-SPEC-021",
    summary: "Contract references an unknown API tag",
    hint: "Declare the tag in metadata.tags or remove the reference.",
  },
} as const satisfies Readonly<Record<NormalizationErrorTag, SpecIssueEntry>>;

export const NORMALIZED_SPEC_WARNING_REGISTRY = {
  "ambiguous-content-type-header": {
    code: "TW-SPEC-101",
    summary: "Content-Type header allows multiple media types",
    hint: "Use one literal Content-Type value when the body representation is media-type specific.",
  },
  "missing-content-type-header": {
    code: "TW-SPEC-102",
    summary: "Body contract has no Content-Type header",
    hint: "Declare a literal Content-Type header so generators can represent the body media type.",
  },
  "raw-body-media-type-fallback": {
    code: "TW-SPEC-103",
    summary: "Raw body uses a fallback media type",
    hint: "Declare a literal Content-Type header matching the raw body representation.",
  },
} as const satisfies Readonly<
  Record<NormalizedSpecWarning["code"], SpecIssueEntry>
>;

const NORMALIZATION_ERROR_PATHS = {
  ContradictorySecurityHeaderError: "/resources",
  DerivedResponseCycleError: "/responses",
  DuplicateOperationIdError: "/resources",
  DuplicateResponseNameError: "/responses",
  DuplicateRouteError: "/resources",
  DuplicateSecuritySchemeNameError: "/securitySchemes",
  DuplicateTagNameError: "/metadata",
  EmptyOperationResponsesError: "/resources",
  EmptyResourceOperationsError: "/resources",
  EmptySpecResourcesError: "/resources",
  InvalidApiMetadataError: "/metadata",
  InvalidDerivedResponseError: "/responses",
  InvalidOperationIdError: "/resources",
  InvalidRequestSchemaError: "/resources",
  InvalidResourceNameError: "/resources",
  InvalidSecurityRequirementError: "/security",
  InvalidSecuritySchemeError: "/securitySchemes",
  MissingDerivedResponseParentError: "/responses",
  PathParameterMismatchError: "/resources",
  UnknownSecuritySchemeError: "/security",
  UnknownTagError: "/metadata",
} as const satisfies Readonly<Record<NormalizationErrorTag, JsonPointer>>;

const pathForNormalizationError = (error: NormalizationError): JsonPointer =>
  NORMALIZATION_ERROR_PATHS[error._tag];

export const getSpecErrorEntry = (
  error: unknown
): SpecIssueEntry | undefined =>
  isNormalizationError(error) ? SPEC_ISSUE_REGISTRY[error._tag] : undefined;

export const normalizationErrorToIssue = (
  error: unknown
): Issue | undefined => {
  if (!isNormalizationError(error)) {
    return undefined;
  }

  const entry = SPEC_ISSUE_REGISTRY[error._tag];
  return {
    code: entry.code,
    severity: "error",
    message: error.message,
    path: pathForNormalizationError(error),
    hint: entry.hint,
    fixable: false,
  };
};

const canonicalResponseWarningPath = (
  location: NormalizedSpecWarningLocation,
  spec: NormalizedSpec
): JsonPointer | undefined => {
  if (location.responseName === undefined) return undefined;
  const responseIndex = spec.responses.findIndex(
    response =>
      response.name === location.responseName &&
      (location.statusCode === undefined ||
        response.statusCode === location.statusCode)
  );
  return responseIndex < 0 ? undefined : `/responses/${responseIndex}/body`;
};

const operationWarningPath = (
  location: NormalizedSpecWarningLocation,
  spec: NormalizedSpec
): JsonPointer | undefined => {
  if (
    location.resourceName === undefined ||
    location.operationId === undefined
  ) {
    return undefined;
  }
  const resourceIndex = spec.resources.findIndex(
    resource => resource.name === location.resourceName
  );
  const resource = spec.resources[resourceIndex];
  if (resource === undefined) return undefined;
  const operationIndex = resource.operations.findIndex(
    operation => operation.operationId === location.operationId
  );
  const operation = resource.operations[operationIndex];
  if (operation === undefined) return undefined;
  const operationPath: JsonPointer = `/resources/${resourceIndex}/operations/${operationIndex}`;
  if (location.part === "request.body") {
    return `${operationPath}/request/body`;
  }
  const responseIndex = operation.responses.findIndex(
    response =>
      response.source === "inline" &&
      response.responseName === location.responseName &&
      (location.statusCode === undefined ||
        response.response.statusCode === location.statusCode)
  );
  return responseIndex < 0
    ? undefined
    : `${operationPath}/responses/${responseIndex}/response/body`;
};

const pathForNormalizedSpecWarning = (
  warning: NormalizedSpecWarning,
  spec: NormalizedSpec | undefined
): JsonPointer => {
  if (spec === undefined) {
    return warning.location.part === "request.body"
      ? "/resources"
      : "/responses";
  }
  return (
    operationWarningPath(warning.location, spec) ??
    canonicalResponseWarningPath(warning.location, spec) ??
    (warning.location.part === "request.body" ? "/resources" : "/responses")
  );
};

export const normalizedSpecWarningToIssue = (
  warning: NormalizedSpecWarning,
  spec?: NormalizedSpec
): Issue => {
  const entry = NORMALIZED_SPEC_WARNING_REGISTRY[warning.code];
  return {
    code: entry.code,
    severity: "warning",
    message: warning.message,
    path: pathForNormalizedSpecWarning(warning, spec),
    hint: entry.hint,
    fixable: false,
  };
};
