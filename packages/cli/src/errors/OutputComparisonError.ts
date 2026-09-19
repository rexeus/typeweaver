import { Data } from "effect";

export type UnsupportedOutputEntryType = "symbolic-link" | "other";

const describeEntryType = (entryType: UnsupportedOutputEntryType): string =>
  entryType === "symbolic-link"
    ? "a symbolic link"
    : "an unsupported filesystem entry";

/**
 * Raised when a committed output tree contains an entry that cannot be
 * compared or copied as a regular file. Generated output is defined as a tree
 * of regular files and directories; following arbitrary symlinks could read
 * or preserve content outside the output boundary, so comparison and snapshot
 * fail closed with the offending relative path.
 */
export class UnsupportedOutputEntryError extends Data.TaggedError(
  "UnsupportedOutputEntryError"
)<{
  readonly root: string;
  readonly relativePath: string;
  readonly entryType: UnsupportedOutputEntryType;
}> {
  public override get message(): string {
    return `Refusing to read generated output '${this.root}' because '${this.relativePath}' is ${describeEntryType(this.entryType)}. Generated output must contain only regular files and directories.`;
  }
}

/**
 * Raised when an expected operating-system failure prevents the comparison
 * from reading a file. Distinguished from `UnsupportedOutputEntryError` so the
 * operator can tell a permissions or I/O problem from an unsupported entry.
 */
export class OutputComparisonReadError extends Data.TaggedError(
  "OutputComparisonReadError"
)<{
  readonly root: string;
  readonly relativePath: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    const detail =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `Failed to read generated output file '${this.relativePath}' under '${this.root}': ${detail}`;
  }
}

/**
 * Raised when an expected operating-system failure prevents copying committed
 * output into the check staging directory.
 */
export class OutputSnapshotError extends Data.TaggedError(
  "OutputSnapshotError"
)<{
  readonly sourceRoot: string;
  readonly relativePath: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    const detail =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `Failed to snapshot generated output file '${this.relativePath}' under '${this.sourceRoot}': ${detail}`;
  }
}
