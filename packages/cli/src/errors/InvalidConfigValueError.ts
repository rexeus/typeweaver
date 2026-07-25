import { Data } from "effect";
import type { ParseResult } from "effect";

/**
 * Raised when a config module exports an object, but one or more known
 * Typeweaver fields do not satisfy the public configuration contract.
 *
 * The complete Schema parse error is retained so callers can report the exact
 * failing path and all invalid fields without turning user input into a defect.
 */
export class InvalidConfigValueError extends Data.TaggedError(
  "InvalidConfigValueError"
)<{
  readonly configPath: string;
  readonly cause: ParseResult.ParseError;
}> {
  public override get message(): string {
    return `Configuration file '${this.configPath}' contains invalid values:\n${this.cause.message}`;
  }
}
