import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { defineMiddleware } from "../TypedMiddleware.js";

export type PoweredByOptions = {
  readonly name?: string;
};

export function poweredBy(options?: PoweredByOptions) {
  const value = options?.name ?? "TypeWeaver";

  return defineMiddleware(async (_ctx, next) => {
    const response = await next();
    const responseHeaders = Object.fromEntries(
      Object.entries(response.header ?? {}).filter(
        ([headerName]) => headerName.toLowerCase() !== "x-powered-by"
      )
    );

    return {
      ...response,
      header: { ...responseHeaders, "x-powered-by": value },
    } satisfies IHttpResponse;
  });
}
