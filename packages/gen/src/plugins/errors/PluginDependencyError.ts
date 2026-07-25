import { Data } from "effect";

export type PluginDependencyIssue =
  | {
      readonly kind: "missing-dependency";
      readonly dependencyName: string;
    }
  | {
      readonly kind: "dependency-cycle";
      readonly path: readonly string[];
    };

/**
 * Raised when the plugin dependency graph cannot be resolved. Exactly one
 * of two scenarios applies:
 *
 *   - `issue.kind: "missing-dependency"` carries `dependencyName`.
 *   - `issue.kind: "dependency-cycle"` carries the structured plugin path.
 */
export class PluginDependencyError extends Data.TaggedError(
  "PluginDependencyError"
)<{
  readonly pluginName: string;
  readonly issue: PluginDependencyIssue;
}> {
  public override get message(): string {
    switch (this.issue.kind) {
      case "missing-dependency":
        return `Plugin '${this.pluginName}' depends on '${this.issue.dependencyName}' which is not loaded`;
      case "dependency-cycle":
        return `Detected plugin dependency cycle: ${this.issue.path.join(" -> ")}`;
    }
  }
}
