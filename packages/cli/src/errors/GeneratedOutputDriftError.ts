import { Data } from "effect";

const formatGroup = (
  label: "Added" | "Removed" | "Changed",
  paths: readonly string[]
): string[] =>
  paths.length === 0
    ? []
    : [label, ...paths.map(relativePath => `  ${relativePath}`), ""];

/**
 * Raised when `typeweaver generate --check` finds that committed output
 * differs from a fresh isolated generation.
 *
 * `added` lists paths present only in fresh output, `removed` lists paths
 * present only in committed output, and `changed` lists equal relative paths
 * whose bytes differ. Every list is already sorted and uses normalized POSIX
 * separators.
 */
export class GeneratedOutputDriftError extends Data.TaggedError(
  "GeneratedOutputDriftError"
)<{
  readonly outputDir: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}> {
  public override get message(): string {
    return [
      `Generated output at '${this.outputDir}' is stale.`,
      "",
      ...formatGroup("Added", this.added),
      ...formatGroup("Removed", this.removed),
      ...formatGroup("Changed", this.changed),
      "Run `typeweaver generate` and commit the updated output.",
    ].join("\n");
  }
}
