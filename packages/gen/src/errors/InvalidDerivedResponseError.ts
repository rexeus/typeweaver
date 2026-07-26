import { Data } from "effect";

export class InvalidDerivedResponseError extends Data.TaggedError(
  "InvalidDerivedResponseError"
)<{
  readonly responseName: string;
}> {
  public override get message(): string {
    return `Derived response '${this.responseName}' contains invalid lineage metadata.`;
  }
}
