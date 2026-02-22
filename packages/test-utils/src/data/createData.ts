import deepmerge from "deepmerge";

/**
 * Creates a data object by deep-merging defaults with optional overrides.
 *
 * Arrays in overrides replace arrays in defaults entirely (no concatenation).
 * This is the low-level primitive used by all test data factories.
 *
 * @template T - The shape of the data object
 * @param defaults - Default values for all fields
 * @param input - Partial overrides to merge on top of defaults
 * @returns A fully populated data object of type `T`
 */
export function createData<T>(defaults: T, input: Partial<T> = {}): T {
  return deepmerge(defaults, input, {
    arrayMerge: (_destinationArray: unknown[], sourceArray: unknown[]) =>
      sourceArray,
  }) as T;
}
