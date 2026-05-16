import { Data } from "effect";
import type { NormalizedRequest } from "../NormalizedSpec.js";

export class InvalidRequestSchemaError extends Data.TaggedError(
  "InvalidRequestSchemaError"
)<{
  readonly operationId: string;
  readonly requestPart: keyof NormalizedRequest;
}> {
  public override get message(): string {
    return `Operation '${this.operationId}' has an invalid request.${this.requestPart} schema definition.`;
  }
}
