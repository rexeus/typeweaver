import { Data } from "effect";

export class DuplicateTagNameError extends Data.TaggedError(
  "DuplicateTagNameError"
)<{
  readonly tagName: string;
}> {
  public override get message(): string {
    return `API tag name '${this.tagName}' must be unique within spec metadata.`;
  }
}
