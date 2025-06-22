import {
  type HttpMethod,
  type IHttpRequest,
  type IHttpResponse,
} from "../definition";
import { RequestValidator } from "../validation";
import { HttpRouteNotFoundError } from "./HttpRouteNotFoundError";

/**
 * Type definition for API route handlers.
 *
 * @template Request - The HTTP request type, must extend IHttpRequest
 * @template Response - The HTTP response type, must extend IHttpResponse
 * @template Context - The execution context type (e.g., Lambda context, Hono context)
 */
export type HttpHandler<
  Request extends IHttpRequest = IHttpRequest,
  Response extends IHttpResponse = IHttpResponse,
  Context extends any = any,
> = (request: Request, context: Context) => Promise<Response>;

/**
 * Type definition for API route configuration.
 *
 * @template Method - The HTTP method type
 * @template Path - The route path string literal type
 * @template Request - The HTTP request type
 * @template Response - The HTTP response type
 * @template Context - The execution context type
 * @template Validator - The request validator type, must extend RequestValidator
 */
export type HttpRoute<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Request extends IHttpRequest = IHttpRequest,
  Response extends IHttpResponse = IHttpResponse,
  Context extends any = any,
  Validator extends RequestValidator = RequestValidator,
> = {
  /** HTTP method for this route (GET, POST, etc.) */
  method: Method;
  /** Route path pattern, supports parameters like /users/:id */
  path: Path;
  /** Handler function that processes requests for this route */
  handler: HttpHandler<Request, Response, Context>;
  /** Request validator that validates incoming requests */
  validator: Validator;
};

/**
 * Utility type for routes where only the context is constrained.
 * Simplifies type definitions when other parameters can be any type.
 *
 * @template TContext - The specific context type to enforce
 */
export type AnyHttpRoute<TContext = any> = HttpRoute<
  any,
  any,
  any,
  any,
  TContext,
  any
>;

/**
 * Internal type representing a processed route segment.
 * @internal
 */
type ProcessedRouteSegment = {
  /** The segment value (e.g., "users" or "{id}") */
  value: string;
  /** Whether this segment is a path parameter */
  isParam: boolean;
};

/**
 * Internal type representing a preprocessed route for efficient matching.
 * @internal
 */
type ProcessedRoute<T extends HttpRoute<any, any, any, any, any, any>> = {
  /** The original route definition */
  original: T;
  /** Parsed route segments */
  segments: ProcessedRouteSegment[];
  /** HTTP method */
  method: string;
  /** Number of path segments */
  segmentCount: number;
  /** Specificity score - lower means more specific (fewer parameters) */
  specificity: number;
};

/**
 * Internal type for route resolution result.
 * @internal
 */
type RouteResolutionResult<T> = {
  route: T;
  params: Record<string, string>;
};

/**
 * Abstract base class for HTTP API routers with built-in request validation.
 *
 * This router provides:
 * - Efficient route matching with preprocessing and caching
 * - Route specificity ordering (specific routes matched before parameterized ones)
 * - Path normalization (handles trailing slashes)
 * - Request validation integration
 *
 * Performance characteristics:
 * - Routes are preprocessed once on first use
 * - Runtime matching is O(n) where n is the number of routes
 * - Path parsing is cached to avoid repeated string operations
 *
 * Route specificity:
 * Routes are automatically ordered by specificity to ensure correct matching:
 * 1. /users/profile (0 parameters - most specific)
 * 2. /users/:id (1 parameter)
 * 3. /users/:id/posts/:postId (2 parameters - least specific)
 *
 * @template Routes - The readonly array type of route definitions
 */
export abstract class HttpRouter<
  Routes extends readonly HttpRoute<
    any,
    any,
    any,
    any,
    any,
    any
  >[] = HttpRoute[],
> {
  private processedRoutes?: ProcessedRoute<Routes[number]>[];

  /**
   * Returns the array of route definitions for this router.
   *
   * @returns The routes array
   */
  public abstract getRoutes(): Routes;

  /**
   * Routes an HTTP request to the appropriate handler without validation.
   *
   * This method:
   * 1. Resolves the matching route for the request
   * 2. Extracts path parameters from the URL (e.g., /users/:id → {id: "123"})
   * 3. Enhances the request with extracted parameters
   * 4. Executes the route's handler with the enhanced request and context
   *
   * Path parameters are automatically extracted and merged into request.param.
   * Existing parameters from adapters are preserved and take precedence.
   *
   * Override this method if you need custom routing behavior.
   *
   * @template Request - The HTTP request type
   * @param request - The HTTP request to route
   * @param context - The execution context
   * @returns Promise resolving to the HTTP response
   * @throws {HttpRouteNotFoundError} When no matching route is found
   */
  public async route<Request extends IHttpRequest = IHttpRequest>(
    request: Request,
    context: any
  ): Promise<IHttpResponse> {
    const routes = this.getRoutes();
    const { route, params } = this.resolveRouteWithParams(routes, request);
    const enhancedRequest = this.enhanceRequestWithParams(request, params);
    return await route.handler(enhancedRequest, context);
  }

  /**
   * Routes an HTTP request to the appropriate handler with request validation.
   *
   * This method:
   * 1. Resolves the matching route for the request
   * 2. Extracts path parameters from the URL (e.g., /users/:id → {id: "123"})
   * 3. Enhances the request with extracted parameters
   * 4. Validates the enhanced request using the route's validator
   * 5. Executes the route's handler with the validated request and context
   *
   * Path parameters are automatically extracted and merged into request.param.
   * Existing parameters from adapters are preserved and take precedence.
   *
   * Override this method if you need custom validation behavior.
   *
   * @template Request - The HTTP request type
   * @param request - The HTTP request to route
   * @param context - The execution context
   * @returns Promise resolving to the HTTP response
   * @throws {HttpRouteNotFoundError} When no matching route is found
   * @throws {RequestValidationError} When request validation fails
   */
  public async routeWithValidation<Request extends IHttpRequest = IHttpRequest>(
    request: Request,
    context: any
  ): Promise<IHttpResponse> {
    const routes = this.getRoutes();
    const { route, params } = this.resolveRouteWithParams(routes, request);
    const enhancedRequest = this.enhanceRequestWithParams(request, params);
    const validatedRequest = route.validator.validate(enhancedRequest);
    return await route.handler(validatedRequest, context);
  }

  /**
   * Gets or creates preprocessed routes for efficient matching.
   *
   * Routes are preprocessed once and cached for subsequent requests.
   * Preprocessing includes:
   * - Parsing path segments
   * - Identifying path parameters
   * - Calculating specificity scores
   * - Sorting by specificity (most specific first)
   *
   * @param routes - The array of route definitions
   * @returns Array of preprocessed routes sorted by specificity
   * @private
   */
  private getProcessedRoutes(routes: Routes): ProcessedRoute<Routes[number]>[] {
    if (!this.processedRoutes) {
      this.processedRoutes = routes
        .map(route => {
          const segments = this.normalizePath(route.path)
            .split("/")
            .filter(Boolean)
            .map(segment => ({
              value: segment,
              isParam: segment.startsWith(":"),
            }));

          return {
            original: route,
            segments,
            method: route.method,
            segmentCount: segments.length,
            specificity: segments.filter(s => s.isParam).length,
          };
        })
        .sort((a, b) => {
          // Sort by specificity (fewer parameters first), then by segment count
          if (a.specificity !== b.specificity) {
            return a.specificity - b.specificity;
          }
          return a.segmentCount - b.segmentCount;
        });
    }
    return this.processedRoutes;
  }

  /**
   * Enhances a request object with extracted path parameters.
   *
   * This method creates a new request object with the extracted parameters,
   * preserving any existing parameters and maintaining immutability.
   *
   * @param request - The original HTTP request
   * @param extractedParams - The extracted path parameters
   * @returns A new request object with enhanced parameters
   * @private
   */
  private enhanceRequestWithParams<Request extends IHttpRequest>(
    request: Request,
    extractedParams: Record<string, string>
  ): Request {
    if (Object.keys(extractedParams).length === 0) {
      return request;
    }

    // existing params take precedence
    const mergedParams = {
      ...extractedParams,
      ...(request.param ?? {}),
    };

    return {
      ...request,
      param: mergedParams,
    };
  }

  /**
   * Normalizes a path by removing trailing slashes.
   *
   * Examples:
   * - "/users/" → "/users"
   * - "/users" → "/users"
   * - "/" → "/" (root path is preserved)
   *
   * @param path - The path to normalize
   * @returns The normalized path
   * @private
   */
  private normalizePath(path: string): string {
    // Remove trailing slash (except for root "/")
    return path === "/" ? "/" : path.replace(/\/$/, "");
  }

  /**
   * Resolves an HTTP request to the matching route definition.
   *
   * This method:
   * 1. Normalizes the request path
   * 2. Gets preprocessed routes (with caching)
   * 3. Iterates through routes in specificity order
   * 4. Matches HTTP method and path segments
   * 5. Returns the first matching route
   *
   * Path matching rules:
   * - Exact segments must match exactly: "users" matches "users"
   * - Parameter segments match any value: ":id" matches "123"
   * - Segment count must match exactly
   * - Most specific routes are checked first
   *
   * @param routes - The array of route definitions
   * @param event - The HTTP request to match
   * @returns The matching route definition
   * @throws {HttpRouteNotFoundError} When no route matches the request
   * @protected
   *
   * @example
   * ```typescript
   * // Given routes: ["/users/profile", "/users/:id"]
   * // Request: GET /users/profile
   * // Returns: the "/users/profile" route (more specific)
   *
   * const route = this.resolveRoute(this.routes, request);
   * ```
   */
  protected resolveRoute(routes: Routes, event: IHttpRequest): Routes[number] {
    const result = this.resolveRouteWithParams(routes, event);
    return result.route;
  }

  /**
   * Resolves an HTTP request to the matching route and extracts path parameters.
   *
   * @param routes - The array of route definitions
   * @param event - The HTTP request to match
   * @returns The matching route and extracted parameters
   * @throws {HttpRouteNotFoundError} When no route matches the request
   * @private
   */
  private resolveRouteWithParams(
    routes: Routes,
    event: IHttpRequest
  ): RouteResolutionResult<Routes[number]> {
    const normalizedPath = this.normalizePath(event.path);
    const calledSegments = normalizedPath.split("/").filter(Boolean);
    const processedRoutes = this.getProcessedRoutes(routes);

    for (const processedRoute of processedRoutes) {
      if (processedRoute.method !== event.method) continue;
      if (processedRoute.segmentCount !== calledSegments.length) continue;

      let matches = true;
      const extractedParams: Record<string, string> = {};

      for (let i = 0; i < processedRoute.segments.length; i++) {
        const segment = processedRoute.segments[i]!;
        const calledSegment = calledSegments[i]!;

        if (segment.isParam) {
          // remove the ":" prefix to get param name
          const paramName = segment.value.slice(1);
          extractedParams[paramName] = decodeURIComponent(calledSegment);
        } else if (segment.value !== calledSegment) {
          // If not a parameter, must match exactly
          matches = false;
          break;
        }
      }

      if (matches) {
        return {
          route: processedRoute.original,
          params: extractedParams,
        };
      }
    }

    throw new HttpRouteNotFoundError(event, routes);
  }
}
