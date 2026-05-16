import { Data } from "effect";

export class DuplicateRouteError extends Data.TaggedError(
  "DuplicateRouteError"
)<{
  readonly method: string;
  readonly path: string;
  readonly normalizedPath: string;
}> {
  public override get message(): string {
    return `Route '${this.method} ${this.path}' conflicts with an existing route using normalized path '${this.normalizedPath}'.`;
  }
}
