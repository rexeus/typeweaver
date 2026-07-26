import { Data } from "effect";

export class MissingDerivedResponseParentError extends Data.TaggedError(
  "MissingDerivedResponseParentError"
)<{
  readonly responseName: string;
  readonly parentName: string;
}> {
  public override get message(): string {
    return `Derived response '${this.responseName}' references missing canonical parent '${this.parentName}'.`;
  }
}
