import Case from "case";
import type { IHttpHeader } from "@rexeus/typeweaver-core";

export type NormalizedHeaders = Record<string, string | string[]>;

export const normalizeHeaders = (
  headers: Headers | undefined | null,
): IHttpHeader => {
  if (!headers) return undefined;

  const result: NormalizedHeaders = {};

  headers.forEach((value, key) => {
    if (!value) return;

    const lowerKey = key.toLowerCase();
    const headerKey = Case.header(key);

    const existing = result[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
        result[lowerKey] = existing;
        result[headerKey] = existing;
      } else {
        result[key] = [existing, value];
        result[lowerKey] = [existing, value];
        result[headerKey] = [existing, value];
      }
    } else {
      result[key] = value;
      result[lowerKey] = value;
      result[headerKey] = value;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
};
