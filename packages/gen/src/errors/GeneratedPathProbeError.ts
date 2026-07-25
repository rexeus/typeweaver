import { Data } from "effect";

export type GeneratedPathProbeOperation = "lstat";

/**
 * An expected Node filesystem failure while inspecting a generated path.
 *
 * Missing path components are not failures: `ENOENT` and `ENOTDIR` mean that
 * generation may safely create the path. Other Node system errors are exposed
 * on the Effect error channel so callers can handle infrastructure failures
 * without turning them into defects.
 */
export class GeneratedPathProbeError extends Data.TaggedError(
  "GeneratedPathProbeError"
)<{
  readonly operation: GeneratedPathProbeOperation;
  readonly requestedPath: string;
  readonly probedPath: string;
  readonly code: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return (
      `Failed to inspect generated path '${this.requestedPath}' with ` +
      `${this.operation} at '${this.probedPath}' (${this.code}).`
    );
  }
}
