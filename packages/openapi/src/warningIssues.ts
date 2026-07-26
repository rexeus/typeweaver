import type { Issue } from "@rexeus/typeweaver-gen";
import type {
  OpenApiBuildWarning,
  OpenApiDiagnosticWarningCode,
  OpenApiSchemaConversionWarningCode,
} from "./types.js";

export type OpenApiWarningCode =
  | OpenApiDiagnosticWarningCode
  | OpenApiSchemaConversionWarningCode;

export type OpenApiWarningIssueEntry = {
  readonly code: `TW-PLUGIN-OPENAPI-${string}`;
  readonly severity: Issue["severity"];
  readonly summary: string;
  readonly hint: string;
};

/**
 * Stable OpenAPI warning codes. Entries are append-only. The record key
 * coverage makes every new exported builder or schema-conversion warning fail
 * typechecking until it receives a public issue code.
 */
export const OPENAPI_WARNING_ISSUE_REGISTRY = {
  "unrepresentable-parameter-container": {
    code: "TW-PLUGIN-OPENAPI-001",
    severity: "warning",
    summary: "Parameter container cannot be represented",
    hint: "Use a finite Zod object for path, query, or header parameters.",
  },
  "unrepresentable-parameter-additional-properties": {
    code: "TW-PLUGIN-OPENAPI-002",
    severity: "warning",
    summary: "Additional parameter properties cannot be represented",
    hint: "Declare every parameter as a named property in a finite Zod object.",
  },
  "missing-path-parameter-schema": {
    code: "TW-PLUGIN-OPENAPI-003",
    severity: "warning",
    summary: "Path parameter schema is missing",
    hint: "Declare a request.param schema for every path parameter.",
  },
  "unused-path-parameter-schema": {
    code: "TW-PLUGIN-OPENAPI-004",
    severity: "warning",
    summary: "Path parameter schema is unused",
    hint: "Remove the unused request.param property or add it to the route path.",
  },
  "missing-canonical-response": {
    code: "TW-PLUGIN-OPENAPI-005",
    severity: "warning",
    summary: "Canonical response is missing",
    hint: "Declare the referenced canonical response in the TypeWeaver spec.",
  },
  "duplicate-canonical-response": {
    code: "TW-PLUGIN-OPENAPI-006",
    severity: "warning",
    summary: "Canonical response is duplicated",
    hint: "Give every canonical response a globally unique name.",
  },
  "unsupported-schema": {
    code: "TW-PLUGIN-OPENAPI-007",
    severity: "info",
    summary: "Schema is not representable in JSON Schema",
    hint: "Replace the schema with a supported Zod shape or accept the documented broadening.",
  },
  "unsupported-check": {
    code: "TW-PLUGIN-OPENAPI-008",
    severity: "info",
    summary: "Schema check is not representable in JSON Schema",
    hint: "Use a supported validation check or enforce it outside the OpenAPI projection.",
  },
  "conversion-error": {
    code: "TW-PLUGIN-OPENAPI-009",
    severity: "info",
    summary: "Schema conversion failed",
    hint: "Inspect the source schema and simplify the unsupported construct.",
  },
  "unrepresentable-resource-description": {
    code: "TW-PLUGIN-OPENAPI-010",
    severity: "info",
    summary: "Resource description cannot be projected losslessly",
    hint: "Describe individual operations or document the resource outside the OpenAPI projection.",
  },
} as const satisfies Readonly<
  Record<OpenApiWarningCode, OpenApiWarningIssueEntry>
>;

const isJsonPointer = (value: string): value is Issue["path"] =>
  value === "" || value.startsWith("/");

export const openApiWarningToIssue = (warning: OpenApiBuildWarning): Issue => {
  const entry = OPENAPI_WARNING_ISSUE_REGISTRY[warning.code];

  return {
    code: entry.code,
    severity: entry.severity,
    message: warning.message,
    path: isJsonPointer(warning.documentPath) ? warning.documentPath : "",
    hint: entry.hint,
    fixable: false,
  };
};
