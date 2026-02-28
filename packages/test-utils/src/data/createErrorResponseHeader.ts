import { createDataFactory } from "./createDataFactory";

/**
 * Creates a factory for error response headers with `Content-Type: application/json` as default.
 *
 * Used by generated error response data utilities to provide consistent
 * header defaults across all error response types.
 *
 * @template T - The header type (must include `Content-Type: "application/json"`)
 * @returns A factory function that produces header objects with optional overrides
 */
export function createErrorResponseHeader<
  T extends { "Content-Type": "application/json" },
>(): (input?: Partial<T>) => T {
  return createDataFactory<T>(
    () =>
      ({
        "Content-Type": "application/json",
      }) as T
  );
}
