export type HeaderMap =
  | Readonly<Record<string, string | readonly string[] | undefined>>
  | undefined;

export function readSingletonHeader(header: HeaderMap, name: string): string | undefined {
  const normalizedName = name.toLowerCase();
  let foundValue: string | undefined;

  for (const [key, value] of Object.entries(header ?? {})) {
    if (value === undefined || key.toLowerCase() !== normalizedName) continue;
    if (foundValue !== undefined || typeof value !== "string") {
      return undefined;
    }

    foundValue = value;
  }

  return foundValue;
}

export function hasHeaderName(header: HeaderMap, name: string): boolean {
  const normalizedName = name.toLowerCase();

  return Object.entries(header ?? {}).some(
    ([key, value]) => value !== undefined && key.toLowerCase() === normalizedName,
  );
}

export function readHeaderValues(header: HeaderMap, name: string): readonly string[] {
  const normalizedName = name.toLowerCase();
  const values: string[] = [];

  for (const [key, value] of Object.entries(header ?? {})) {
    if (value === undefined || key.toLowerCase() !== normalizedName) continue;

    if (typeof value === "string") {
      values.push(value);
    } else {
      values.push(...value);
    }
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
    if (value === undefined || normalizedNames.has(key.toLowerCase())) continue;
    headers[key] = typeof value === "string" ? value : [...value];
  }

  return headers;
}
