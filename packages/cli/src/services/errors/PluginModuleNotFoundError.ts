import { Data } from "effect";

/**
 * Failure raised when a plugin module specifier cannot be resolved or
 * loaded. The original `cause` is preserved for diagnostic purposes.
 */
export class PluginModuleNotFoundError extends Data.TaggedError(
  "PluginModuleNotFoundError"
)<{
  readonly specifier: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    const causeMessage =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `Failed to load plugin module '${this.specifier}': ${causeMessage}`;
  }
}
