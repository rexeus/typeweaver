import { Data } from "effect";

export class MissingCanonicalResponseError extends Data.TaggedError(
  "MissingCanonicalResponseError"
)<{
  readonly responseName: string;
}> {
  public override get message(): string {
    return `Missing canonical response '${this.responseName}' in the normalized spec.`;
  }
}
