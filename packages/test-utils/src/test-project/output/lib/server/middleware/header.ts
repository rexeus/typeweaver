export type HeaderMap = Record<string, string | string[]> | undefined;

export function readSingletonHeader(header: HeaderMap, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  let foundValue: string | undefined;

  for (const [key, value] of Object.entries(header ?? {})) {
    if (key.toLowerCase() !== normalizedName) continue;
    if (foundValue !== undefined || typeof value !== "string") {
      return undefined;
    }

    foundValue = value;
  }

  return foundValue;
}

export function hasHeaderName(header: HeaderMap, name: string): boolean {
  const normalizedName = name.toLowerCase();

  return Object.keys(header ?? {}).some((key) => key.toLowerCase() === normalizedName);
}

export function readHeaderValues(header: HeaderMap, name: string): readonly string[] {
  const normalizedName = name.toLowerCase();
  const values: string[] = [];

  for (const [key, value] of Object.entries(header ?? {})) {
    if (key.toLowerCase() !== normalizedName) continue;

    values.push(...(Array.isArray(value) ? value : [value]));
  }

  return values;
}

export function omitHeaders(
  header: HeaderMap,
  names: readonly string[],
): Record<string, string | string[]> {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  const headers: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(header ?? {})) {
    if (normalizedNames.has(key.toLowerCase())) continue;
    headers[key] = value;
  }

  return headers;
}
