export type {
  Issue,
  IssueCode,
  IssueSourceLocation,
  JsonPointer,
  Severity,
} from "./Issue.js";
export {
  getSpecErrorEntry,
  NORMALIZED_SPEC_WARNING_REGISTRY,
  normalizationErrorToIssue,
  normalizedSpecWarningToIssue,
  SPEC_ISSUE_REGISTRY,
} from "./specIssueRegistry.js";
export type { SpecIssueEntry } from "./specIssueRegistry.js";
