export const errnoCode = (error: unknown): string | undefined =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : undefined;

/**
 * Recognizes an operating-system filesystem failure. Node filesystem errors
 * carry the failing syscall and/or a numeric errno; this structural check
 * covers platform-specific libuv codes (for example EISDIR) without
 * misclassifying arbitrary application errors that merely expose a string
 * `code`.
 */
export const isExpectedNodeSystemError = (error: unknown): error is Error => {
  const code = errnoCode(error);
  if (code === undefined || !(error instanceof Error)) {
    return false;
  }

  return (
    ("syscall" in error && typeof error.syscall === "string") ||
    ("errno" in error && typeof error.errno === "number")
  );
};
