import { Data } from "effect";

export class EmptyOperationResponsesError extends Data.TaggedError(
  "EmptyOperationResponsesError"
)<{
  readonly operationId: string;
}> {
  public override get message(): string {
    return `Operation '${this.operationId}' must declare at least one response.`;
  }
}
