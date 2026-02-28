import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware";

export type PoweredByOptions = {
  readonly name?: string;
};

export function poweredBy(options?: PoweredByOptions) {
  const value = options?.name ?? "TypeWeaver";

  return defineMiddleware(async (_ctx, next) => {
    const response = await next();

    return {
      ...response,
      header: { ...response.header, "x-powered-by": value },
    } satisfies IHttpResponse;
  });
}
