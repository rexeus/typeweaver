import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware.js";
import { omitHeaders, readSingletonHeader } from "./header.js";

export type RequestIdOptions = {
  readonly headerName?: string;
  readonly generator?: () => string;
};

const isValidRequestId = (value: string | undefined): value is string =>
  value !== undefined && value.length > 0 && !/[\r\n]/.test(value);

export function requestId(options?: RequestIdOptions) {
  const headerName = (options?.headerName ?? "x-request-id").toLowerCase();
  const generator = options?.generator ?? (() => crypto.randomUUID());

  return defineMiddleware<{ requestId: string }>(async (ctx, next) => {
    const existing = readSingletonHeader(ctx.request.header, headerName);
    const id = isValidRequestId(existing) ? existing : generator();

    const response = await next({ requestId: id });
    const header = omitHeaders(response.header, [headerName]);

    return {
      ...response,
      header: { ...header, [headerName]: id },
    } satisfies IHttpResponse;
  });
}
