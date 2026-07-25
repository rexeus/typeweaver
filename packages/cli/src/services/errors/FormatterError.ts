import { Data } from "effect";
import type { PlatformError } from "@effect/platform/Error";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export type FormatterFileSystemOperation =
  | "realPath"
  | "readDirectory"
  | "stat"
  | "readFileString"
  | "writeFileString";

/**
 * The optional formatter package was present but could not be loaded. A
 * genuine package-not-found error is handled separately as the documented
 * no-op case.
 */
export class FormatterLoadError extends Data.TaggedError("FormatterLoadError")<{
  readonly moduleName: "oxfmt";
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to load optional formatter '${this.moduleName}': ${formatCause(this.cause)}`;
  }
}

/**
 * A filesystem operation required by the formatter failed. Platform errors
 * are retained so callers can inspect their structured reason and operation.
 */
export class FormatterFileSystemError extends Data.TaggedError(
  "FormatterFileSystemError"
)<{
  readonly operation: FormatterFileSystemOperation;
  readonly path: string;
  readonly cause: PlatformError;
}> {
  public override get message(): string {
    return `Formatter filesystem ${this.operation} failed for '${this.path}': ${formatCause(this.cause)}`;
  }
}

/**
 * `oxfmt` rejected one generated source file. This is an operational
 * formatter failure, not a defect in the Effect program.
 */
export class FormatterExecutionError extends Data.TaggedError(
  "FormatterExecutionError"
)<{
  readonly filePath: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Formatter failed for '${this.filePath}': ${formatCause(this.cause)}`;
  }
}

export type FormatterError =
  | FormatterExecutionError
  | FormatterFileSystemError
  | FormatterLoadError;
