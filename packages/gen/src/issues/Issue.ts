/**
 * Stable severity levels shared by plugin validation, CLI diagnostics, and
 * machine-readable reports.
 */
export type Severity = "error" | "warning" | "info";

export type IssueCode = `TW-${string}-${string}`;

export type JsonPointer = "" | `/${string}`;

/**
 * Optional source coordinates for diagnostics backed by a concrete file.
 * Line and column numbers are one-based when present.
 */
export type IssueSourceLocation = {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;
};

/**
 * A side-effect-free validation result. `path` is a JSON Pointer into the
 * normalized contract; the empty string addresses the contract root.
 */
export type Issue = {
  readonly code: IssueCode;
  readonly severity: Severity;
  readonly message: string;
  readonly path: JsonPointer;
  readonly source?: IssueSourceLocation;
  readonly hint?: string;
  readonly fixable: boolean;
};
