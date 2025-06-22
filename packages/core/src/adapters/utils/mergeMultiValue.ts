import type { IHttpHeader, IHttpQuery } from "../../definition";

export const mergeMultiValueHeaders = (
  single?: Record<string, string | undefined> | null,
  multi?: Record<string, string[] | undefined> | null
): IHttpHeader => {
  const result: Record<string, string | string[]> = {};

  // Add single values
  if (single) {
    for (const [key, value] of Object.entries(single)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  // Merge multi values (overwriting singles if present)
  if (multi) {
    for (const [key, values] of Object.entries(multi)) {
      if (values !== undefined && values.length > 0) {
        const filtered = values.filter((v): v is string => v !== undefined);
        if (filtered.length === 1) {
          result[key] = filtered[0]!;
        } else if (filtered.length > 1) {
          result[key] = filtered;
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

export const mergeMultiValueQuery = (
  single?: Record<string, string | undefined> | null,
  multi?: Record<string, string[] | undefined> | null,
  decode = true
): IHttpQuery => {
  const result: Record<string, string | string[]> = {};

  // Add single values with optional URL decoding
  if (single) {
    for (const [key, value] of Object.entries(single)) {
      if (value !== undefined) {
        result[key] = decode ? decodeURIComponent(value) : value;
      }
    }
  }

  // Merge multi values with optional URL decoding
  if (multi) {
    for (const [key, values] of Object.entries(multi)) {
      if (values !== undefined && values.length > 0) {
        const filtered = values.filter((v): v is string => v !== undefined);
        const processed = decode
          ? filtered.map(v => decodeURIComponent(v))
          : filtered;

        if (processed.length === 1) {
          result[key] = processed[0]!;
        } else if (processed.length > 1) {
          result[key] = processed;
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};
