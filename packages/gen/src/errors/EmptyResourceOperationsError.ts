import { Data } from "effect";

export class EmptyResourceOperationsError extends Data.TaggedError(
  "EmptyResourceOperationsError"
)<{
  readonly resourceName: string;
}> {
  public override get message(): string {
    return `Resource '${this.resourceName}' must contain at least one operation.`;
  }
}
