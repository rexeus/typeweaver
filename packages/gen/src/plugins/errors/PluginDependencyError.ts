import { Data } from "effect";

/**
 * Raised when the plugin dependency graph cannot be resolved. Exactly one
 * of two scenarios applies:
 *
 *   - **Missing dependency.** `missingDependency` carries the unresolved
 *     plugin name; `cyclePath` is `undefined`.
 *   - **Cycle.** `cyclePath` carries the human-readable cycle string;
 *     `missingDependency` is `undefined`.
 *
 * Programmatic consumers should branch on `cyclePath !== undefined` rather
 * than inspecting `missingDependency` for cycles — the previous code
 * inverted that contract by re-using `missingDependency` to store the
 * cycle's start node.
 */
export class PluginDependencyError extends Data.TaggedError(
  "PluginDependencyError"
)<{
  readonly pluginName: string;
  readonly missingDependency?: string;
  readonly cyclePath?: string;
}> {
  public override get message(): string {
    if (this.cyclePath !== undefined) {
      return this.cyclePath;
    }
    return `Plugin '${this.pluginName}' depends on '${
      this.missingDependency ?? "<unknown>"
    }' which is not loaded`;
  }
}
