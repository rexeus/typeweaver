import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware.js";
import { omitHeaders } from "./header.js";

export type SecureHeadersOptions = {
  readonly contentTypeOptions?: string | false;
  readonly frameOptions?: string | false;
  readonly strictTransportSecurity?: string | false;
  readonly referrerPolicy?: string | false;
  readonly xssProtection?: string | false;
  readonly downloadOptions?: string | false;
  readonly dnsPrefetchControl?: string | false;
  readonly permittedCrossDomainPolicies?: string | false;
  readonly crossOriginResourcePolicy?: string | false;
  readonly crossOriginOpenerPolicy?: string | false;
  readonly crossOriginEmbedderPolicy?: string | false;
  readonly originAgentCluster?: string | false;
};

const DEFAULTS: ReadonlyArray<readonly [keyof SecureHeadersOptions, string, string]> = [
  ["contentTypeOptions", "x-content-type-options", "nosniff"],
  ["frameOptions", "x-frame-options", "SAMEORIGIN"],
  ["strictTransportSecurity", "strict-transport-security", "max-age=15552000; includeSubDomains"],
  ["referrerPolicy", "referrer-policy", "no-referrer"],
  ["xssProtection", "x-xss-protection", "0"],
  ["downloadOptions", "x-download-options", "noopen"],
  ["dnsPrefetchControl", "x-dns-prefetch-control", "off"],
  ["permittedCrossDomainPolicies", "x-permitted-cross-domain-policies", "none"],
  ["crossOriginResourcePolicy", "cross-origin-resource-policy", "same-origin"],
  ["crossOriginOpenerPolicy", "cross-origin-opener-policy", "same-origin"],
  ["crossOriginEmbedderPolicy", "cross-origin-embedder-policy", "require-corp"],
  ["originAgentCluster", "origin-agent-cluster", "?1"],
];

export function secureHeaders(options?: SecureHeadersOptions) {
  const headers: Record<string, string> = {};

  for (const [optionKey, headerName, defaultValue] of DEFAULTS) {
    const value = options?.[optionKey];
    if (value === false) continue;
    headers[headerName] = value ?? defaultValue;
  }

  return defineMiddleware(async (_ctx, next) => {
    const response = await next();
    const header = omitHeaders(response.header, Object.keys(headers));

    return {
      ...response,
      header: { ...header, ...headers },
    } satisfies IHttpResponse;
  });
}
