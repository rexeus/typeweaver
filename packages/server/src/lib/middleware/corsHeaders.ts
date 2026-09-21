import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { readHeaderValues } from "./header.js";

const POLICY_CONTROLLED_CORS_HEADERS = new Set([
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-max-age",
]);

export function mergeCorsHeadersIntoResponse(
  response: IHttpResponse,
  corsHeaders: Record<string, string>
): IHttpResponse {
  return {
    ...response,
    header: mergeResponseHeaders(response.header, corsHeaders),
  };
}

function splitHeaderValues(values: readonly string[]): readonly string[] {
  return values.flatMap(value =>
    value
      .split(",")
      .map(item => item.trim())
      .filter(item => item.length > 0)
  );
}

function mergeVary(existing: readonly string[], value: string): string {
  const values = splitHeaderValues(existing);
  if (values.length === 0) return value;

  const hasValue = values.some(
    item => item.toLowerCase() === value.toLowerCase()
  );
  return hasValue ? values.join(", ") : [...values, value].join(", ");
}

function removePolicyControlledCorsHeaders(
  responseHeaders: Record<string, string | string[] | undefined> | undefined
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(responseHeaders ?? {})) {
    if (
      value === undefined ||
      POLICY_CONTROLLED_CORS_HEADERS.has(key.toLowerCase())
    ) {
      continue;
    }
    result[key] = value;
  }

  return result;
}

function mergeResponseHeaders(
  responseHeaders: Record<string, string | string[] | undefined> | undefined,
  corsHeaders: Record<string, string>
): Record<string, string | string[]> {
  const result = removePolicyControlledCorsHeaders(responseHeaders);
  const mergedCorsHeaders = { ...corsHeaders };
  if (corsHeaders["vary"] !== undefined) {
    for (const key of Object.keys(result)) {
      if (key.toLowerCase() === "vary") delete result[key];
    }
    mergedCorsHeaders["vary"] = mergeVary(
      readHeaderValues(responseHeaders, "vary"),
      corsHeaders["vary"]
    );
  }

  return { ...result, ...mergedCorsHeaders };
}
