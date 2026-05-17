import { Data } from "effect";

export type PluginLoadAttempt = {
  readonly path: string;
  readonly error: string;
};

export class PluginLoadError extends Data.TaggedError("PluginLoadError")<{
  readonly pluginName: string;
  readonly attempts: readonly PluginLoadAttempt[];
}> {
  public override get message(): string {
    const header = `Failed to load plugin '${this.pluginName}'`;
    if (this.attempts.length === 0) {
      return `${header}.`;
    }

    const rows = this.attempts
      .map(attempt => `  - ${attempt.path}: ${attempt.error}`)
      .join("\n");
    return `${header}. Tried:\n${rows}`;
  }
}
