import type { ApiMetadataDefinition } from "@rexeus/typeweaver-core";
import { Data } from "effect";

export class InvalidApiMetadataError extends Data.TaggedError(
  "InvalidApiMetadataError"
)<{
  readonly field: keyof ApiMetadataDefinition;
  readonly reason: string;
}> {
  public override get message(): string {
    return `Spec metadata.${this.field} is invalid: ${this.reason}.`;
  }
}
