import {
  lookupSpecErrorEntry,
  SPEC_LOAD_FAILURE_CODE,
} from "../../specErrorRegistry.js";
import type { Issue } from "../types.js";

export const mapSpecErrorToIssue = (error: unknown): Issue => {
  const entry = lookupSpecErrorEntry(error);

  if (entry !== undefined) {
    return {
      code: entry.code,
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      hint: entry.hint,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    code: SPEC_LOAD_FAILURE_CODE,
    severity: "error",
    message,
    hint: "Fix the underlying spec-loading error. Run with --verbose for the full trace.",
  };
};
