import { Data } from "effect";

export class DuplicateSecuritySchemeNameError extends Data.TaggedError(
  "DuplicateSecuritySchemeNameError"
)<{
  readonly schemeName: string;
}> {
  public override get message(): string {
    return `Security scheme name '${this.schemeName}' must be unique within a spec.`;
  }
}
