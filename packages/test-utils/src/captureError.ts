/**
 * Captures a synchronous error thrown by the given function.
 *
 * Useful in tests to assert that a function throws a specific error type
 * without using `expect(...).toThrow()`, which doesn't give access to
 * the error instance for further assertions.
 *
 * @template T - The expected error type (default: `Error`)
 * @param fn - The function expected to throw
 * @returns The captured error, or `undefined` if no error was thrown
 *
 * @example
 * ```typescript
 * const error = captureError<ValidationError>(() => validator.validate(invalidData));
 * expect(error).toBeInstanceOf(ValidationError);
 * expect(error?.issues).toHaveLength(2);
 * ```
 */
export const captureError = <T = Error>(fn: () => void): T | undefined => {
  try {
    fn();
  } catch (error) {
    return error as T;
  }
  return undefined;
};
