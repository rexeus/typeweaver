import { Data } from "effect";

/**
 * Raised when the post-plugin index-file emission pass fails — typically
 * because the EJS template cannot be read, rendering throws, or the
 * underlying `writeFile` rejects the synthesized barrel path.
 */
export class IndexFileGenerationError extends Data.TaggedError(
  "IndexFileGenerationError"
)<{
  readonly outputDir: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Index file generation failed in ${this.outputDir}: ${
      this.cause instanceof Error ? this.cause.message : String(this.cause)
    }`;
  }
}
