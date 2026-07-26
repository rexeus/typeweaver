import { Data } from "effect";

export class ContradictorySecurityHeaderError extends Data.TaggedError(
  "ContradictorySecurityHeaderError"
)<{
  readonly operationId: string;
  readonly schemeName: string;
}> {
  public override get message(): string {
    return `Operation '${this.operationId}' declares an Authorization header that rejects credentials required by security scheme '${this.schemeName}'.`;
  }
}
