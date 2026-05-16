import { Data } from "effect";

export class PluginDependencyError extends Data.TaggedError(
  "PluginDependencyError"
)<{
  readonly pluginName: string;
  readonly missingDependency: string;
  readonly cyclePath?: string;
}> {
  public override get message(): string {
    if (this.cyclePath !== undefined) {
      return this.cyclePath;
    }
    return `Plugin '${this.pluginName}' depends on '${this.missingDependency}' which is not loaded`;
  }
}
