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
    return `Failed to load plugin '${this.pluginName}'`;
  }
}
