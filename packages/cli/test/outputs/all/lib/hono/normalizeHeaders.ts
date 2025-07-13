import Case from "case";
import type { IHttpHeader } from "@rexeus/typeweaver-core";

export interface NormalizedHeaders {
  [key: string]: string | string[];
}

export const normalizeHeaders = (
  headers: Record<string, string | string[] | undefined> | null,
): IHttpHeader => {
  if (!headers) return undefined;

  const result: NormalizedHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;

    const processedValue =
      typeof value === "string" ? value.split(",").map((v) => v.trim()) : value;

    const filteredValue = processedValue.filter((v) => v !== "");
    if (filteredValue.length === 0) continue;

    const lowerKey = key.toLowerCase();
    const headerKey = Case.header(key);

    const finalValue: string | string[] =
      filteredValue.length === 1 ? filteredValue[0]! : filteredValue;

    result[lowerKey] = finalValue;
    result[headerKey] = finalValue;
    result[key] = finalValue;
  }

  return Object.keys(result).length > 0 ? result : undefined;
};
