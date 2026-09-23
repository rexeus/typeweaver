import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { expect } from "vitest";
import { executeMiddlewarePipeline } from "../../../../src/lib/Middleware.js";
import { cors } from "../../../../src/lib/middleware/cors.js";
import { createServerContext } from "../../../helpers.js";
import type { CorsOptions } from "../../../../src/lib/middleware/cors.js";

export const policyControlledCorsHeaderNames = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-max-age",
] as const;

export const permissiveCorsHeaders = {
  "Access-Control-Allow-Origin": "https://evil.com",
  "access-control-allow-credentials": "true",
  "access-control-expose-headers": "X-Evil",
  "access-control-allow-methods": "GET, POST",
  "access-control-allow-headers": "Authorization",
  "access-control-max-age": "3600",
};

export type DownstreamPermissiveCorsPolicyOptions = {
  readonly statusCode?: IHttpResponse["statusCode"];
  readonly header?: Record<string, string | string[]> | undefined;
  readonly body?: IHttpResponse["body"];
};

export function downstreamResponseWithPermissiveCorsPolicy({
  statusCode = 200,
  header = {},
  body,
}: DownstreamPermissiveCorsPolicyOptions = {}): IHttpResponse {
  return {
    statusCode,
    header: { ...permissiveCorsHeaders, ...header },
    ...(body !== undefined ? { body } : {}),
  };
}

export type RunCorsOptions = {
  readonly options?: CorsOptions;
  readonly method?: HttpMethod;
  readonly header?: Record<string, string | string[] | undefined> | undefined;
  readonly finalHandler?: () => Promise<IHttpResponse>;
};

export async function executeCors({
  options,
  method,
  header,
  finalHandler = async () => ({ statusCode: 200, body: { ok: true } }),
}: RunCorsOptions = {}): Promise<IHttpResponse> {
  const mw = options !== undefined ? cors(options) : cors();
  const ctx = createServerContext({
    ...(method !== undefined ? { method } : {}),
    ...(header ? { header } : {}),
  });

  return executeMiddlewarePipeline([mw.handler], ctx, finalHandler);
}

export function expectNoPolicyControlledCorsHeaders(
  response: IHttpResponse
): void {
  const responseHeaderNames = Object.keys(response.header ?? {}).map(key =>
    key.toLowerCase()
  );

  for (const headerName of policyControlledCorsHeaderNames) {
    expect(responseHeaderNames).not.toContain(headerName);
  }
}
