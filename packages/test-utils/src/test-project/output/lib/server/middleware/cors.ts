import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware.js";
import { hasHeaderName, readHeaderValues, readSingletonHeader } from "./header.js";

export type CorsOptions = {
  readonly origin?: string | readonly string[] | ((origin: string) => string | undefined);
  readonly allowMethods?: readonly string[];
  readonly allowHeaders?: readonly string[];
  readonly exposeHeaders?: readonly string[];
  readonly maxAge?: number;
  readonly credentials?: boolean;
};

const DEFAULT_METHODS = ["GET", "HEAD", "PUT", "POST", "PATCH", "DELETE"] as const;

const POLICY_CONTROLLED_CORS_HEADERS = new Set([
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-max-age",
]);

function resolveOrigin(
  configOrigin: CorsOptions["origin"],
  requestOrigin: string | undefined,
  credentials: boolean,
): string | undefined {
  if (configOrigin === undefined || configOrigin === "*") {
    if (credentials) return undefined;
    return "*";
  }

  if (typeof configOrigin === "function") {
    return requestOrigin ? configOrigin(requestOrigin) : undefined;
  }

  if (typeof configOrigin === "string") {
    return configOrigin;
  }

  return requestOrigin && configOrigin.includes(requestOrigin) ? requestOrigin : undefined;
}

function getRequestOrigin(
  header: Record<string, string | string[]> | undefined,
): string | undefined {
  return readSingletonHeader(header, "origin");
}

function isOriginDependentWithoutRequestOrigin(
  configOrigin: CorsOptions["origin"],
  credentials: boolean,
): boolean {
  return (
    typeof configOrigin === "function" ||
    Array.isArray(configOrigin) ||
    ((configOrigin === undefined || configOrigin === "*") && credentials)
  );
}

function splitHeaderValues(values: readonly string[]): readonly string[] {
  return values.flatMap((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
}

function mergeVary(existing: readonly string[], value: string): string {
  const values = splitHeaderValues(existing);
  if (values.length === 0) return value;

  const hasValue = values.some((item) => item.toLowerCase() === value.toLowerCase());

  return hasValue ? values.join(", ") : [...values, value].join(", ");
}

function removePolicyControlledCorsHeaders(
  responseHeaders: Record<string, string | string[]> | undefined,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(responseHeaders ?? {})) {
    if (POLICY_CONTROLLED_CORS_HEADERS.has(key.toLowerCase())) continue;

    result[key] = value;
  }

  return result;
}

function mergeResponseHeaders(
  responseHeaders: Record<string, string | string[]> | undefined,
  corsHeaders: Record<string, string>,
): Record<string, string | string[]> {
  const result = removePolicyControlledCorsHeaders(responseHeaders);

  const mergedCorsHeaders = { ...corsHeaders };
  if (corsHeaders.vary !== undefined) {
    for (const key of Object.keys(result)) {
      if (key.toLowerCase() === "vary") delete result[key];
    }

    mergedCorsHeaders.vary = mergeVary(readHeaderValues(responseHeaders, "vary"), corsHeaders.vary);
  }

  return { ...result, ...mergedCorsHeaders };
}

export function cors(options?: CorsOptions) {
  const credentials = options?.credentials ?? false;

  const methods = (options?.allowMethods ?? DEFAULT_METHODS).join(", ");
  const exposeHeaders = options?.exposeHeaders?.join(", ");
  const maxAge = options?.maxAge?.toString();

  return defineMiddleware(async (ctx, next) => {
    const requestOrigin = getRequestOrigin(ctx.request.header);
    const hasOrigin = hasHeaderName(ctx.request.header, "origin");
    const resolvedOrigin =
      hasOrigin && requestOrigin === undefined
        ? undefined
        : resolveOrigin(options?.origin, requestOrigin, credentials);
    const origin = credentials && resolvedOrigin === "*" ? undefined : resolvedOrigin;

    if (origin === undefined) {
      const response = await next();

      if (!hasOrigin && !isOriginDependentWithoutRequestOrigin(options?.origin, credentials)) {
        return response;
      }

      return {
        ...response,
        header: mergeResponseHeaders(response.header, { vary: "Origin" }),
      } satisfies IHttpResponse;
    }

    const corsHeaders: Record<string, string> = {
      "access-control-allow-origin": origin,
    };

    if (credentials) {
      corsHeaders["access-control-allow-credentials"] = "true";
    }

    if (origin !== "*") {
      corsHeaders["vary"] = "Origin";
    }

    if (exposeHeaders) {
      corsHeaders["access-control-expose-headers"] = exposeHeaders;
    }

    const isPreflight =
      ctx.request.method === "OPTIONS" &&
      requestOrigin !== undefined &&
      readSingletonHeader(ctx.request.header, "access-control-request-method") !== undefined;

    if (isPreflight) {
      corsHeaders["access-control-allow-methods"] = methods;

      const configuredHeaders = options?.allowHeaders;
      if (configuredHeaders !== undefined) {
        if (configuredHeaders.length > 0) {
          corsHeaders["access-control-allow-headers"] = configuredHeaders.join(", ");
        }
      } else {
        const requestedHeaders = readSingletonHeader(
          ctx.request.header,
          "access-control-request-headers",
        );
        if (typeof requestedHeaders === "string") {
          corsHeaders["access-control-allow-headers"] = requestedHeaders;
        }
      }

      if (maxAge) {
        corsHeaders["access-control-max-age"] = maxAge;
      }

      return {
        statusCode: 204,
        header: corsHeaders,
      } satisfies IHttpResponse;
    }

    const response = await next();

    return {
      ...response,
      header: mergeResponseHeaders(response.header, corsHeaders),
    } satisfies IHttpResponse;
  });
}
