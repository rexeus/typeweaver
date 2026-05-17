import { Data } from "effect";

export class SpecOutputWriteError extends Data.TaggedError(
  "SpecOutputWriteError"
)<{
  readonly path: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to write spec output to '${this.path}': ${formatCause(this.cause)}`;
  }
}

const formatCause = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
};
