export type {
  Issue,
  IssueCode,
  IssueSourceLocation,
  JsonPointer,
  Severity,
} from "./Issue.js";
export {
  getSpecErrorEntry,
  normalizationErrorToIssue,
  SPEC_ISSUE_REGISTRY,
} from "./specIssueRegistry.js";
export type { SpecIssueEntry } from "./specIssueRegistry.js";
