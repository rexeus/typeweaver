import type { HttpAdapter } from "../../adapters/HttpAdapter";
import type { HttpRouter } from "../HttpRouter";
import type { HttpHandlerOptions } from "./HandlerOptions";
import { resolveErrorHandling, createErrorResponse } from "./errorHandling";

/**
 * Creates a platform-specific HTTP handler function.
 *
 * This factory function provides a generic implementation for creating
 * handlers that work with different platforms (Hono, AWS Lambda, etc.)
 * while sharing common error handling and validation logic.
 *
 * @template TEvent - The platform-specific event type
 * @template TResult - The platform-specific result type
 * @template TContext - The platform-specific context type
 * @template TRouter - The router type (must extend HttpRouter)
 *
 * @param router - The HTTP router instance
 * @param adapter - The platform-specific adapter
 * @param options - Handler configuration options
 * @param extractContext - Function to extract the context for the router from the platform context
 * @returns A platform-specific handler function
 */
export function createHttpHandler<
  TEvent,
  TResult,
  TContext,
  TRouter extends HttpRouter<any>,
>(
  router: TRouter,
  adapter: HttpAdapter<TEvent, TResult>,
  options: HttpHandlerOptions<TContext> | undefined,
  extractContext: (event: TEvent, context: TContext) => any
): (event: TEvent, context: TContext) => Promise<TResult> {
  const validate = options?.validate ?? true;
  const shouldHandle = resolveErrorHandling(options?.handleErrors);

  return async (event: TEvent, context: TContext): Promise<TResult> => {
    try {
      const request = await adapter.toRequest(event);
      const routerContext = extractContext(event, context);

      const response = validate
        ? await router.routeWithValidation(request, routerContext)
        : await router.route(request, routerContext);

      return adapter.toResponse(response);
    } catch (error) {
      // First chance for custom error handling
      if (options?.onError) {
        const customResponse = await options.onError(error, context);
        if (customResponse) {
          return adapter.toResponse(customResponse);
        }
      }

      // Built-in error handling
      const errorResponse = createErrorResponse(error, shouldHandle);
      if (errorResponse) {
        return adapter.toResponse(errorResponse);
      }

      // Re-throw unhandled errors
      throw error;
    }
  };
}
