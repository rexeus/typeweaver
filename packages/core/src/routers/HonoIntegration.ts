import {
  type HttpMethod,
  type IHttpRequest,
  type IHttpResponse,
} from "../definition";
import {
  HttpRouter,
  type HttpHandler,
  type HttpRoute,
  type AnyHttpRoute,
} from "./HttpRouter";
import type { RequestValidator } from "../validation";
import { type Context as HonoContext, type Handler as HonoHandler } from "hono";
import { HonoAdapter } from "../adapters/HonoAdapter";
import { createHttpHandler, type HttpHandlerOptions } from "./utils";

export type { Context as HonoContext } from "hono";

export type HonoHttpRequestHandler<
  Request extends IHttpRequest = IHttpRequest,
  Response extends IHttpResponse = IHttpResponse,
> = HttpHandler<Request, Response, HonoContext>;

export type HonoHttpRoute<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Request extends IHttpRequest = IHttpRequest,
  Response extends IHttpResponse = IHttpResponse,
  Validator extends RequestValidator = RequestValidator,
> = HttpRoute<Method, Path, Request, Response, HonoContext, Validator>;

/**
 * Hono-specific HTTP router that extends HttpRouter with HonoContext typing.
 *
 * This router ensures that all routes use HonoContext as their context type,
 * providing better type safety for Hono applications.
 *
 * @template Routes - The readonly array type of Hono-specific route definitions
 */
export abstract class HonoHttpRouter<
  Routes extends
    readonly AnyHttpRoute<HonoContext>[] = readonly AnyHttpRoute<HonoContext>[],
> extends HttpRouter<Routes> {
  /**
   * Routes an HTTP request to the appropriate handler without validation.
   *
   * @template Request - The HTTP request type
   * @param request - The HTTP request to route
   * @param context - The Hono context
   * @returns Promise resolving to the HTTP response
   * @throws {HttpRouteNotFoundError} When no matching route is found
   */
  public override async route<Request extends IHttpRequest = IHttpRequest>(
    request: Request,
    context: HonoContext
  ): Promise<IHttpResponse> {
    return super.route(request, context);
  }

  /**
   * Routes an HTTP request to the appropriate handler with request validation.
   *
   * @template Request - The HTTP request type
   * @param request - The HTTP request to route
   * @param context - The Hono context
   * @returns Promise resolving to the HTTP response
   * @throws {HttpRouteNotFoundError} When no matching route is found
   * @throws {RequestValidationError} When request validation fails
   */
  public override async routeWithValidation<
    Request extends IHttpRequest = IHttpRequest,
  >(request: Request, context: HonoContext): Promise<IHttpResponse> {
    return super.routeWithValidation(request, context);
  }
}

/**
 * Creates a Hono-compatible handler function from a HonoHttpRouter.
 * This factory function bridges the gap between Hono's context-based
 * handlers and the router interface.
 *
 * @param router - The HonoHttpRouter instance to wrap
 * @param options - Optional configuration
 * @param options.validate - Whether to validate requests (default: true)
 * @param options.handleErrors - Error handling strategy (default: "auto")
 * @param options.onError - Custom error handler that returns IHttpResponse
 * @returns A function that can be used as a Hono route handler
 *
 * @example
 * ```typescript
 * // Custom error response
 * createHonoHttpApiHandler(router, {
 *   onError: (error) => {
 *     if (error instanceof MyCustomError) {
 *       return {
 *         statusCode: 422,
 *         body: { error: error.code, message: error.message },
 *         header: { "content-type": "application/json" }
 *       };
 *     }
 *   }
 * })
 * ```
 */
export function createHonoHttpApiHandler(
  router: HonoHttpRouter<any>,
  options?: HttpHandlerOptions<HonoContext>
): HonoHandler {
  const adapter = new HonoAdapter();
  const handler = createHttpHandler(
    router,
    adapter,
    options,
    (_event, context) => context // For Hono, the context is passed directly
  );

  // Hono expects (context) => Promise<Response>, our handler expects (event, context)
  return (honoContext: HonoContext): Promise<Response> => {
    return handler(honoContext, honoContext);
  };
}
