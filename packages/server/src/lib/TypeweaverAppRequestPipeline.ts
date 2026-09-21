import {
  createDefaultErrorResponse,
  methodNotAllowedDefaultError,
  normalizeHttpResponse,
  notFoundDefaultError,
} from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { executeMiddlewarePipeline } from "./Middleware.js";
import { StateMap } from "./StateMap.js";
import type { FetchApiAdapter } from "./FetchApiAdapter.js";
import type { Middleware } from "./Middleware.js";
import type { Router, RouteDefinition, RouteMatch } from "./Router.js";
import type { ServerContext } from "./ServerContext.js";

export async function processAppRequest(options: {
  readonly request: Request;
  readonly adapter: FetchApiAdapter;
  readonly router: Router;
  readonly middlewares: Middleware[];
  readonly resolveAndExecute: (
    match: RouteMatch | undefined,
    pathname: string,
    ctx: ServerContext
  ) => Promise<IHttpResponse>;
}): Promise<IHttpResponse> {
  const { request, adapter, router, middlewares, resolveAndExecute } = options;
  const url = new URL(request.url);
  const httpRequest = await adapter.toRequest(request, url);
  const match = router.match(request.method, url.pathname);
  const ctx: ServerContext = {
    request: httpRequest,
    signal: request.signal,
    state: new StateMap(),
    route: match
      ? {
          operationId: match.route.operationId,
          method: match.route.method,
          path: match.route.path,
        }
      : undefined,
  };
  const response = await executeMiddlewarePipeline(middlewares, ctx, () =>
    resolveAndExecute(match, url.pathname, ctx)
  );
  return request.method.toUpperCase() === "HEAD"
    ? { ...response, body: undefined }
    : response;
}

export async function resolveAppRequest(options: {
  readonly match: RouteMatch | undefined;
  readonly pathname: string;
  readonly ctx: ServerContext;
  readonly router: Router;
  readonly executeHandler: (
    ctx: ServerContext,
    route: RouteDefinition
  ) => Promise<IHttpResponse>;
  readonly validateResponse: (
    route: RouteDefinition,
    response: IHttpResponse,
    ctx: ServerContext
  ) => Promise<IHttpResponse>;
  readonly handleError: (
    error: unknown,
    ctx: ServerContext,
    route: RouteDefinition
  ) => Promise<IHttpResponse>;
}): Promise<IHttpResponse> {
  const {
    match,
    pathname,
    ctx,
    router,
    executeHandler,
    validateResponse,
    handleError,
  } = options;
  if (match) {
    const routeCtx = withPathParams(ctx, match.params);
    try {
      const response = await executeHandler(routeCtx, match.route);
      return await validateResponse(
        match.route,
        normalizeHttpResponse(response),
        routeCtx
      );
    } catch (error) {
      return handleError(error, routeCtx, match.route);
    }
  }

  const pathMatch = router.matchPath(pathname);
  if (pathMatch) {
    return createDefaultErrorResponse(methodNotAllowedDefaultError, {
      header: { Allow: pathMatch.allowedMethods.join(", ") },
    });
  }
  return createDefaultErrorResponse(notFoundDefaultError);
}

function withPathParams(
  ctx: ServerContext,
  params: Record<string, string>
): ServerContext {
  if (Object.keys(params).length === 0) return ctx;
  return { ...ctx, request: { ...ctx.request, param: params } };
}
