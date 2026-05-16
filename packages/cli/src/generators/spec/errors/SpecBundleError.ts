import { Data } from "effect";

export class SpecBundleError extends Data.TaggedError("SpecBundleError")<{
  readonly inputFile: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to bundle spec entrypoint '${this.inputFile}': ${formatCause(this.cause)}`;
  }
}

const formatCause = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
};
