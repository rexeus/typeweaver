import { Data } from "effect";

export type PluginScaffoldFileSystemOperation =
  | "exists"
  | "makeDirectory"
  | "readTemplate"
  | "remove"
  | "writeFile";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export class InvalidPluginScaffoldNameError extends Data.TaggedError(
  "InvalidPluginScaffoldNameError"
)<{
  readonly pluginName: string;
}> {
  public override get message(): string {
    return (
      `Invalid plugin name '${this.pluginName}'. ` +
      "Use lowercase kebab-case, for example 'audit-log'."
    );
  }
}

export class PluginScaffoldTargetExistsError extends Data.TaggedError(
  "PluginScaffoldTargetExistsError"
)<{
  readonly targetDir: string;
}> {
  public override get message(): string {
    return `Plugin scaffold target '${this.targetDir}' already exists; choose a new directory.`;
  }
}

export class PluginScaffoldFileSystemError extends Data.TaggedError(
  "PluginScaffoldFileSystemError"
)<{
  readonly operation: PluginScaffoldFileSystemOperation;
  readonly path: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to ${this.operation} plugin scaffold path '${this.path}': ${formatCause(this.cause)}`;
  }
}
