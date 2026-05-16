import { Data } from "effect";

export type PluginExecutionPhase =
  | "initialize"
  | "collectResources"
  | "generate"
  | "finalize";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export class PluginExecutionError extends Data.TaggedError(
  "PluginExecutionError"
)<{
  readonly pluginName: string;
  readonly phase: PluginExecutionPhase;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Plugin '${this.pluginName}' failed during ${this.phase}: ${formatCause(this.cause)}`;
  }
}
