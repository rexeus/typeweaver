import { Data } from "effect";

export class InvalidSecurityRequirementError extends Data.TaggedError(
  "InvalidSecurityRequirementError"
)<{
  readonly schemeName?: string;
  readonly contractPath: string;
  readonly reason: string;
}> {
  public override get message(): string {
    const subject =
      this.schemeName === undefined
        ? "Security requirement"
        : `Security requirement for scheme '${this.schemeName}'`;
    return `${subject} at '${this.contractPath}' is invalid: ${this.reason}.`;
  }
}
