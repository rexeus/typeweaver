import { Data } from "effect";

const formatCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * Raised when rendering an EJS-like template throws — typically a malformed
 * interpolation tag or an expression referencing data the caller did not
 * supply. Template content is authored by plugin developers, so this is an
 * expected, recoverable failure rather than a defect.
 */
export class TemplateRenderError extends Data.TaggedError(
  "TemplateRenderError"
)<{
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to render template: ${formatCause(this.cause)}`;
  }
}
