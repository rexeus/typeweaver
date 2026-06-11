import { Data } from "effect";

// Module evaluation failures are not guaranteed to be `Error` instances —
// bundler-transformed imports (e.g. under vitest/vite) can reject with
// plain objects that still carry a `message`.
const formatCause = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    typeof cause.message === "string"
  ) {
    return cause.message;
  }
  return String(cause);
};

/**
 * Raised when evaluating the user's config module fails for any reason other
 * than the structural tagged `ConfigError` variants — syntax errors, missing
 * imports, or custom throws inside the module body. The original failure is
 * preserved on `cause` so diagnostics keep the underlying error class and
 * stack, while the CLI's error channel stays a closed tagged union.
 */
export class ConfigModuleEvaluationError extends Data.TaggedError(
  "ConfigModuleEvaluationError"
)<{
  readonly configPath: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    return `Failed to load configuration file '${this.configPath}': ${formatCause(this.cause)}`;
  }
}
