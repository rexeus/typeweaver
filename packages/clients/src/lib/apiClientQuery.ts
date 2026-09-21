import type {
  ClientHttpQuery,
  ClientHttpScalar,
} from "@rexeus/typeweaver-core";
import { serializeHttpScalar } from "./apiClientSerialization.js";
import { RequestSerializationError } from "./RequestSerializationError.js";

export function buildQueryString(
  query: ClientHttpQuery | undefined,
  defaultQuery: Readonly<Record<string, string>>
): string {
  if (!query && Object.keys(defaultQuery).length === 0) return "";

  const params = new URLSearchParams();
  const mergedQuery: ClientHttpQuery = { ...defaultQuery, ...query };
  for (const [key, value] of Object.entries(mergedQuery)) {
    appendQueryValue(params, key, value);
  }
  return params.toString();
}

function appendQueryValue(
  params: URLSearchParams,
  key: string,
  value: ClientHttpScalar | readonly ClientHttpScalar[] | undefined
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    params.append(key, serializeHttpScalar(value, "query", key));
    return;
  }
  if (value.length === 0) {
    throw new RequestSerializationError("query", key, value, "empty-array");
  }
  for (const item of value) {
    if (item !== undefined) {
      params.append(key, serializeHttpScalar(item, "query", key));
    }
  }
}
