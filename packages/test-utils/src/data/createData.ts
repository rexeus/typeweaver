import deepmerge from "deepmerge";

/**
 * Partial overrides that may explicitly set a property to `undefined`.
 *
 * Under `exactOptionalPropertyTypes`, `Partial<T>` does not accept an explicit
 * `undefined` for a required property of `T`. Test overrides frequently forward
 * optional values, so the override shape admits `undefined` deliberately.
 */
export type DataOverrides<T> = {
  [Key in keyof T]?: T[Key] | undefined;
};

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
export function createData<T>(defaults: T, input: DataOverrides<T> = {}): T {
  return deepmerge(defaults, input, {
    arrayMerge: (_destinationArray: unknown[], sourceArray: unknown[]) =>
      sourceArray,
  }) as T;
}
