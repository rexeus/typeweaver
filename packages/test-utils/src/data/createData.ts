import deepmerge from "deepmerge";

export function createData<T>(defaults: T, input: Partial<T> = {}): T {
  return deepmerge(defaults, input, {
    arrayMerge: (_destinationArray: unknown[], sourceArray: unknown[]) => sourceArray, // Replace arrays instead of concatenating
  }) as T;
}
