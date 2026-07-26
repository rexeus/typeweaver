import { Data } from "effect";

/**
 * Tagged normalization-side counterpart of the plain
 * `DuplicateResponseNameError` thrown by `@rexeus/typeweaver-core`'s
 * `validateUniqueResponseNames`. The core package stays dependency-free
 * (the same error fires from `defineSpec` in user authoring code), so the
 * normalizer wraps it at its boundary — keeping the `NormalizationError`
 * union homogeneous and fully addressable via `Effect.catchTag`.
 */
export class DuplicateResponseNameError extends Data.TaggedError(
  "DuplicateResponseNameError"
)<{
  readonly responseName: string;
}> {
  public override get message(): string {
    return `Response name '${this.responseName}' must be globally unique within a spec.`;
  }
}
