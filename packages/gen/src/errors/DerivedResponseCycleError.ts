import { Data } from "effect";

export class DerivedResponseCycleError extends Data.TaggedError(
  "DerivedResponseCycleError"
)<{
  readonly responseName: string;
}> {
  public override get message(): string {
    return `Derived response '${this.responseName}' contains a cyclic lineage.`;
  }
}
