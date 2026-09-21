import type { IHttpResponse, IRawHttpRequest } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware.js";
import { mergeCorsHeadersIntoResponse } from "./corsHeaders.js";
import { hasHeaderName, readSingletonHeader } from "./header.js";

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

type NormalizedCorsOptions = {
  readonly origin: CorsOptions["origin"];
  readonly allowMethods: string;
  readonly allowHeaders: readonly string[] | undefined;
  readonly exposeHeaders: string | undefined;
  readonly maxAge: string | undefined;
  readonly credentials: boolean;
};

type CorsRequest = {
  readonly header: IRawHttpRequest["header"];
  readonly method: IRawHttpRequest["method"];
  readonly hasOrigin: boolean;
  readonly origin: string | undefined;
};

function normalizeCorsOptions(
  options: CorsOptions = {}
): NormalizedCorsOptions {
  return {
    origin: options.origin,
    allowMethods: (options.allowMethods ?? DEFAULT_METHODS).join(", "),
    allowHeaders: options.allowHeaders,
    exposeHeaders: options.exposeHeaders?.join(", "),
    maxAge: options.maxAge?.toString(),
    credentials: options.credentials ?? false,
  };
}

function resolveOrigin(
  configOrigin: CorsOptions["origin"],
  requestOrigin: string | undefined,
  credentials: boolean
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

  return requestOrigin && configOrigin.includes(requestOrigin)
    ? requestOrigin
    : undefined;
}

function getRequestOrigin(
  header: IRawHttpRequest["header"]
): string | undefined {
  return readSingletonHeader(header, "origin");
}

function readCorsRequest(request: IRawHttpRequest): CorsRequest {
  return {
    header: request.header,
    method: request.method,
    hasOrigin: hasHeaderName(request.header, "origin"),
    origin: getRequestOrigin(request.header),
  };
}

function isOriginDependentWithoutRequestOrigin(
  configOrigin: CorsOptions["origin"],
  credentials: boolean
): boolean {
  return (
    typeof configOrigin === "function" ||
    Array.isArray(configOrigin) ||
    ((configOrigin === undefined || configOrigin === "*") && credentials)
  );
}

function resolveRequestOrigin(
  options: NormalizedCorsOptions,
  request: CorsRequest
): string | undefined {
  if (request.hasOrigin && request.origin === undefined) {
    return undefined;
  }

  const resolvedOrigin = resolveOrigin(
    options.origin,
    request.origin,
    options.credentials
  );

  return options.credentials && resolvedOrigin === "*"
    ? undefined
    : resolvedOrigin;
}

function shouldVaryDeniedCorsResponse(
  options: NormalizedCorsOptions,
  request: CorsRequest
): boolean {
  return (
    request.hasOrigin ||
    isOriginDependentWithoutRequestOrigin(options.origin, options.credentials)
  );
}

function buildSimpleCorsHeaders(
  options: NormalizedCorsOptions,
  origin: string
): Record<string, string> {
  const corsHeaders: Record<string, string> = {
    "access-control-allow-origin": origin,
  };

  if (options.credentials) {
    corsHeaders["access-control-allow-credentials"] = "true";
  }

  if (origin !== "*") {
    corsHeaders["vary"] = "Origin";
  }

  if (options.exposeHeaders) {
    corsHeaders["access-control-expose-headers"] = options.exposeHeaders;
  }

  return corsHeaders;
}

function isPreflightCorsRequest(request: CorsRequest): boolean {
  return (
    request.method === "OPTIONS" &&
    request.origin !== undefined &&
    readSingletonHeader(request.header, "access-control-request-method") !==
      undefined
  );
}

function buildPreflightCorsHeaders(
  options: NormalizedCorsOptions,
  request: CorsRequest,
  simpleCorsHeaders: Record<string, string>
): Record<string, string> {
  const corsHeaders = { ...simpleCorsHeaders };
  corsHeaders["access-control-allow-methods"] = options.allowMethods;

  if (options.allowHeaders !== undefined) {
    if (options.allowHeaders.length > 0) {
      corsHeaders["access-control-allow-headers"] =
        options.allowHeaders.join(", ");
    }
  } else {
    const requestedHeaders = readSingletonHeader(
      request.header,
      "access-control-request-headers"
    );
    if (typeof requestedHeaders === "string") {
      corsHeaders["access-control-allow-headers"] = requestedHeaders;
    }
  }

  if (options.maxAge !== undefined) {
    corsHeaders["access-control-max-age"] = options.maxAge;
  }

  return corsHeaders;
}

export function cors(options?: CorsOptions) {
  const normalizedOptions = normalizeCorsOptions(options);

  return defineMiddleware(async (ctx, next) => {
    const corsRequest = readCorsRequest(ctx.request);
    const origin = resolveRequestOrigin(normalizedOptions, corsRequest);

    if (origin === undefined) {
      const response = await next();

      if (!shouldVaryDeniedCorsResponse(normalizedOptions, corsRequest)) {
        return response;
      }

      return mergeCorsHeadersIntoResponse(response, { vary: "Origin" });
    }

    const corsHeaders = buildSimpleCorsHeaders(normalizedOptions, origin);

    if (isPreflightCorsRequest(corsRequest)) {
      const preflightHeaders = buildPreflightCorsHeaders(
        normalizedOptions,
        corsRequest,
        corsHeaders
      );

      return {
        statusCode: 204,
        header: preflightHeaders,
      } satisfies IHttpResponse;
    }

    const response = await next();

    return mergeCorsHeadersIntoResponse(response, corsHeaders);
  });
}
