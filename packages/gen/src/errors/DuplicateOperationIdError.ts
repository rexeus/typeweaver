import { Data } from "effect";

export class DuplicateOperationIdError extends Data.TaggedError(
  "DuplicateOperationIdError"
)<{
  readonly operationId: string;
}> {
  public override get message(): string {
    return `Operation ID '${this.operationId}' must be globally unique within a spec.`;
  }
}
