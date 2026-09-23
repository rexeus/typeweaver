import { createDataFactory } from "./createDataFactory.js";
import type { DataOverrides } from "./createData.js";

type ErrorResponseHeader = { "Content-Type": "application/json" };

/**
 * Creates a factory for error response headers with `Content-Type: application/json` as default.
 *
 * Used by generated error response data utilities to provide consistent
 * header defaults across all error response types.
 *
 * @template T - The header type (must include `Content-Type: "application/json"`)
 * @returns A factory function that produces header objects with optional overrides
 */
export function createErrorResponseHeader<T extends ErrorResponseHeader>(): (
  input?: DataOverrides<T>
) => T;
// Callers instantiate `T` with error headers whose only required field is the
// JSON content type, so this default is complete for every intended `T`.
export function createErrorResponseHeader(): (
  input?: DataOverrides<ErrorResponseHeader>
) => ErrorResponseHeader {
  return createDataFactory<ErrorResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));
}
