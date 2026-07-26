import { Data } from "effect";

export class UnknownSecuritySchemeError extends Data.TaggedError(
  "UnknownSecuritySchemeError"
)<{
  readonly schemeName: string;
  readonly contractPath: string;
}> {
  public override get message(): string {
    return `Security requirement at '${this.contractPath}' references unknown scheme '${this.schemeName}'.`;
  }
}
