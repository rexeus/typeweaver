import { Data } from "effect";

export class EmptySpecResourcesError extends Data.TaggedError(
  "EmptySpecResourcesError"
)<{}> {
  public override get message(): string {
    return "Spec definition must contain at least one resource.";
  }
}
