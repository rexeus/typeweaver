import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware";

export type CorsOptions = {
  readonly origin?:
    | string
    | readonly string[]
    | ((origin: string) => string | undefined);
  readonly allowMethods?: readonly string[];
  readonly allowHeaders?: readonly string[];
  readonly exposeHeaders?: readonly string[];
  readonly maxAge?: number;
  readonly credentials?: boolean;
};

const DEFAULT_METHODS = [
  "GET",
  "HEAD",
  "PUT",
  "POST",
  "PATCH",
  "DELETE",
] as const;

function resolveOrigin(
  configOrigin: CorsOptions["origin"],
  requestOrigin: string | undefined,
  credentials: boolean
): string | undefined {
  if (configOrigin === undefined || configOrigin === "*") {
    if (credentials && requestOrigin) return requestOrigin;
    return "*";
  }

  if (typeof configOrigin === "function") {
    return requestOrigin ? configOrigin(requestOrigin) : undefined;
  }

  if (typeof configOrigin === "string") {
    return configOrigin;
  }

  return requestOrigin && configOrigin.includes(requestOrigin)
    ? requestOrigin
    : undefined;
}

function getRequestOrigin(
  header: Record<string, string | string[]> | undefined
): string | undefined {
  const origin = header?.["origin"];
  return typeof origin === "string" ? origin : undefined;
}

export function cors(options?: CorsOptions) {
  const credentials = options?.credentials ?? false;
  const methods = (options?.allowMethods ?? DEFAULT_METHODS).join(", ");
  const exposeHeaders = options?.exposeHeaders?.join(", ");
  const maxAge = options?.maxAge?.toString();

  return defineMiddleware(async (ctx, next) => {
    const requestOrigin = getRequestOrigin(ctx.request.header);
    const origin = resolveOrigin(options?.origin, requestOrigin, credentials);

    if (origin === undefined) return next();

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
      ctx.request.header?.["access-control-request-method"] !== undefined;

    if (isPreflight) {
      corsHeaders["access-control-allow-methods"] = methods;

      const configuredHeaders = options?.allowHeaders;
      if (configuredHeaders && configuredHeaders.length > 0) {
        corsHeaders["access-control-allow-headers"] =
          configuredHeaders.join(", ");
      } else {
        const requestedHeaders =
          ctx.request.header?.["access-control-request-headers"];
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
      header: { ...corsHeaders, ...response.header },
    } satisfies IHttpResponse;
  });
}
