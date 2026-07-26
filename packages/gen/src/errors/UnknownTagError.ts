import { Data } from "effect";

export class UnknownTagError extends Data.TaggedError("UnknownTagError")<{
  readonly tagName: string;
  readonly contractPath: string;
}> {
  public override get message(): string {
    return `Tag reference '${this.tagName}' at '${this.contractPath}' is not declared in spec metadata.`;
  }
}
