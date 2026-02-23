import { createData } from "./createData";

/**
 * Creates a reusable factory function that produces data objects with defaults.
 *
 * Each invocation of the returned factory calls `getDefaults()` fresh,
 * ensuring no shared mutable state between test cases.
 *
 * @template T - The shape of the data object
 * @param getDefaults - Function that returns fresh default values on each call
 * @returns A factory function that accepts optional partial overrides
 *
 * @example
 * ```typescript
 * const createUser = createDataFactory(() => ({
 *   name: "Jane",
 *   email: "jane@example.com",
 * }));
 *
 * const user = createUser({ name: "John" });
 * // => { name: "John", email: "jane@example.com" }
 * ```
 */
export function createDataFactory<T>(
  getDefaults: () => T
): (input?: Partial<T>) => T {
  return (input: Partial<T> = {}) => createData(getDefaults(), input);
}
