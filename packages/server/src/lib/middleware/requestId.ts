import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware";

export type RequestIdOptions = {
  readonly headerName?: string;
  readonly generator?: () => string;
};

export function requestId(options?: RequestIdOptions) {
  const headerName = options?.headerName ?? "x-request-id";
  const generator = options?.generator ?? (() => crypto.randomUUID());

  return defineMiddleware<{ requestId: string }>(async (ctx, next) => {
    const existing = ctx.request.header?.[headerName];
    const id =
      typeof existing === "string"
        ? existing
        : Array.isArray(existing)
          ? existing[0]!
          : generator();

    const response = await next({ requestId: id });

    return {
      ...response,
      header: { ...response.header, [headerName]: id },
    } satisfies IHttpResponse;
  });
}
