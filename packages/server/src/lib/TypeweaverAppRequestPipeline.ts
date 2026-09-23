import {
  createDefaultErrorResponse,
  methodNotAllowedDefaultError,
  normalizeHttpResponse,
  notFoundDefaultError,
} from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { executeMiddlewarePipeline } from "./Middleware.js";
import { StateMap } from "./StateMap.js";
import {
  handleAppError,
  validateAppResponse,
} from "./TypeweaverAppErrorHandling.js";
import type { FetchApiAdapter } from "./FetchApiAdapter.js";
import type { Middleware } from "./Middleware.js";
import type { Router } from "./Router.js";
import type { RouteDefinition, RouteMatch } from "./routerTypes.js";
import type { ServerContext } from "./ServerContext.js";

/**
 * Runs one Fetch request through the app: adapter conversion, route matching,
 * the middleware chain, the matched handler with response validation and the
 * route's error handlers, and HEAD body stripping.
 *
 * `safeOnError` reports failures that the pipeline recovers from, such as an
 * error handler that throws.
 */
export async function processAppRequest(options: {
  readonly request: Request;
  readonly adapter: FetchApiAdapter;
  readonly router: Router;
  readonly middlewares: Middleware[];
  readonly safeOnError: (error: unknown) => void;
}): Promise<IHttpResponse> {
  const { request, adapter, router, middlewares, safeOnError } = options;
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
    match
      ? executeRoute(match, ctx, safeOnError)
      : respondWithoutRoute(router, url.pathname)
  );
  return request.method.toUpperCase() === "HEAD"
    ? { ...response, body: undefined }
    : response;
}

async function executeRoute(
  match: RouteMatch,
  ctx: ServerContext,
  safeOnError: (error: unknown) => void
): Promise<IHttpResponse> {
  const { route } = match;
  const routeCtx = withPathParams(ctx, match.params);
  try {
    const response = await executeRouteHandler(route, routeCtx);
    // Await inside the `try` so a validator that throws or rejects reaches the
    // route's error handlers instead of the app's generic safety net.
    return await validateAppResponse({
      route,
      response: normalizeHttpResponse(response),
      ctx: routeCtx,
      safeOnError,
    });
  } catch (error) {
    return handleAppError({ error, ctx: routeCtx, route, safeOnError });
  }
}

async function executeRouteHandler(
  route: RouteDefinition,
  ctx: ServerContext
): Promise<IHttpResponse> {
  const request = route.routerConfig.validateRequests
    ? route.requestValidator.validate(ctx.request)
    : ctx.request;
  return route.handler(request, ctx);
}

async function respondWithoutRoute(
  router: Router,
  pathname: string
): Promise<IHttpResponse> {
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
