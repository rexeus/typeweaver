import type { IHttpResponse } from "../../definition";

// Extract types for better clarity
type ErrorHandlerResult = IHttpResponse | void;

// Discriminated union for type-safe error handling configuration
export type ErrorHandlingOptions =
  | { mode: "auto" }
  | { mode: "throwAll" }
  | {
      mode: "custom";
      /** Handle HttpRouteNotFoundError as 404 (default: true) */
      notFound?: boolean;
      /** Handle RequestValidationError as 400 (default: true) */
      validation?: boolean;
      /** Handle HttpResponse as response (default: true) */
      httpResponse?: boolean;
    };

/**
 * Common options for HTTP handler creation across different platforms.
 *
 * @template TContext - The platform-specific context type (e.g., HonoContext, LambdaContext)
 */
export type HttpHandlerOptions<TContext> = {
  /** Whether to validate requests (default: true) */
  validate?: boolean;

  /**
   * Error handling strategy (default: { mode: "auto" })
   * - { mode: "auto" }: Handle all standard errors (404, 400, HttpResponse)
   * - { mode: "throwAll" }: Throw all errors without handling
   * - { mode: "custom", ... }: Granular control over error handling
   */
  handleErrors?: ErrorHandlingOptions;

  /**
   * Custom error handler (called before built-in handling)
   * Return an IHttpResponse to override default handling, or void to continue with defaults
   */
  onError?: (
    error: unknown,
    context: TContext
  ) => ErrorHandlerResult | Promise<ErrorHandlerResult>;
};
