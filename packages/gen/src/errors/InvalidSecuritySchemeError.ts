import { Data } from "effect";

export class InvalidSecuritySchemeError extends Data.TaggedError(
  "InvalidSecuritySchemeError"
)<{
  readonly schemeName: string;
  readonly reason: string;
}> {
  public override get message(): string {
    return `Security scheme '${this.schemeName}' is invalid: ${this.reason}.`;
  }
}
