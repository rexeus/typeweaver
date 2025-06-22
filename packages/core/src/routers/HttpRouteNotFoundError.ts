import type { IHttpRequest } from "../definition";
import type { HttpRoute } from "./HttpRouter";

/**
 * Error thrown when no route matches an incoming HTTP request.
 *
 * This error is thrown by the router when:
 * - No route matches the request method
 * - No route matches the request path pattern
 * - The path segment count doesn't match any route
 *
 * The error includes both the failed request and all defined routes
 * for debugging purposes.
 */
export class HttpRouteNotFoundError extends Error {
  /**
   * Creates a new HttpRouteNotFoundError.
   *
   * @param httpRequest - The HTTP request that couldn't be routed
   * @param definedRoutes - All routes defined in the router
   */
  constructor(
    public readonly httpRequest: IHttpRequest,
    public readonly definedRoutes: readonly HttpRoute[]
  ) {
    super("HTTP route not found");
  }
}
