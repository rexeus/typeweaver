export function createData<T>(defaults: T, input: Partial<T> = {}): T {
  return { ...defaults, ...input };
}
