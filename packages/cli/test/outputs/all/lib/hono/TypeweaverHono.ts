import { Hono, type Context } from "hono";
import {
  HttpResponse,
  RequestValidationError,
  type IHttpRequest,
  type IHttpResponse,
  type IRequestValidator,
} from "@rexeus/typeweaver-core";
import { HonoAdapter } from "./HonoAdapter";
import type { HonoRequestHandler } from "./HonoRequestHandler";
import type { HonoOptions } from "hono/hono-base";
import type { BlankEnv, BlankSchema, Env, Schema } from "hono/types";

/**
 * Handles HTTP response errors thrown by request handlers.
 * @param error - The HTTP response error that was thrown
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type HttpResponseErrorHandler = (
  error: HttpResponse,
  context: Context,
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles request validation errors.
 * @param error - The validation error containing field-specific issues
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type ValidationErrorHandler = (
  error: RequestValidationError,
  context: Context,
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles any unknown errors not caught by other handlers.
 * @param error - The unknown error (could be anything)
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type UnknownErrorHandler = (
  error: unknown,
  context: Context,
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Configuration options for TypeweaverHono routers.
 * @template RequestHandlers - Type containing all request handler methods
 * @template HonoEnv - Hono environment type for middleware context
 */
export type TypeweaverHonoOptions<
  RequestHandlers,
  HonoEnv extends Env = BlankEnv,
> = HonoOptions<HonoEnv> & {
  /**
   * Request handler methods for each operation.
   * Each handler receives a request (validated if `validateRequests` is true) and Hono context.
   */
  requestHandlers: RequestHandlers;

  /**
   * Enable request validation using generated validators.
   * When false, requests are passed through without validation.
   * @default true
   */
  validateRequests?: boolean;

  /**
   * Configure handling of HttpResponse errors thrown by handlers.
   * - `true`: Use default handler (returns the error as-is)
   * - `false`: Let errors bubble up to Hono
   * - `function`: Use custom error handler
   * @default true
   */
  handleHttpResponseErrors?: HttpResponseErrorHandler | boolean;

  /**
   * Configure handling of request validation errors.
   * - `true`: Use default handler (400 with error details)
   * - `false`: Let errors bubble up to Hono
   * - `function`: Use custom error handler
   * @default true
   */
  handleValidationErrors?: ValidationErrorHandler | boolean;

  /**
   * Configure handling of unknown errors.
   * - `true`: Use default handler (500 Internal Server Error)
   * - `false`: Let errors bubble up to Hono
   * - `function`: Use custom error handler
   * @default true
   */
  handleUnknownErrors?: UnknownErrorHandler | boolean;
};

/**
 * Abstract base class for TypeWeaver-generated Hono routers.
 *
 * Extends Hono with TypeWeaver-specific features:
 * - Automatic request validation using generated validators
 * - Configurable error handling for validation, HTTP, and unknown errors
 * - Type-safe request/response handling with adapters
 *
 * @template RequestHandlers - Object containing typed request handler methods
 * @template HonoEnv - Hono environment type (default: BlankEnv)
 * @template HonoSchema - Hono schema type (default: BlankSchema)
 * @template HonoBasePath - Base path for routes (default: "/")
 */
export abstract class TypeweaverHono<
  RequestHandlers,
  HonoEnv extends Env = BlankEnv,
  HonoSchema extends Schema = BlankSchema,
  HonoBasePath extends string = "/",
> extends Hono<HonoEnv, HonoSchema, HonoBasePath> {
  /**
   * Adapter for converting between Hono and TypeWeaver request/response formats.
   */
  protected readonly adapter = new HonoAdapter();

  /**
   * Request handlers provided during construction.
   */
  protected readonly requestHandlers: RequestHandlers;

  /**
   * Resolved configuration for validation and error handling.
   */
  private readonly config: {
    validateRequests: boolean;
    errorHandlers: {
      validation: ValidationErrorHandler | undefined;
      httpResponse: HttpResponseErrorHandler | undefined;
      unknown: UnknownErrorHandler | undefined;
    };
  };

  /**
   * Default error handlers used when custom handlers are not provided.
   */
  private readonly defaultHandlers = {
    validation: (error: RequestValidationError): IHttpResponse => ({
      statusCode: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: error.message,
        issues: {
          header: error.headerIssues,
          body: error.bodyIssues,
          query: error.queryIssues,
          param: error.pathParamIssues,
        },
      },
    }),

    httpResponse: (error: HttpResponse): IHttpResponse => error,

    unknown: (): IHttpResponse => ({
      statusCode: 500,
      body: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    }),
  };

  /**
   * Creates a new TypeweaverHono router instance.
   *
   * @param options - Configuration options including request handlers and error handling
   * @param options.requestHandlers - Object containing all request handler methods
   * @param options.validateRequests - Whether to validate requests (default: true)
   * @param options.handleHttpResponseErrors - Handler or boolean for HTTP errors (default: true)
   * @param options.handleValidationErrors - Handler or boolean for validation errors (default: true)
   * @param options.handleUnknownErrors - Handler or boolean for unknown errors (default: true)
   */
  public constructor(options: TypeweaverHonoOptions<RequestHandlers, HonoEnv>) {
    const {
      requestHandlers,
      validateRequests = true,
      handleHttpResponseErrors,
      handleValidationErrors,
      handleUnknownErrors,
      ...honoOptions
    } = options;

    super(honoOptions);

    this.requestHandlers = requestHandlers;

    // Resolve configuration
    this.config = {
      validateRequests,
      errorHandlers: {
        validation: this.resolveErrorHandler(handleValidationErrors, (error) =>
          this.defaultHandlers.validation(error),
        ),
        httpResponse: this.resolveErrorHandler(
          handleHttpResponseErrors,
          (error) => this.defaultHandlers.httpResponse(error),
        ),
        unknown: this.resolveErrorHandler(handleUnknownErrors, () =>
          this.defaultHandlers.unknown(),
        ),
      },
    };

    // FIXME: on error handler is not catching errors from handlers, only validation errors
    // this.registerErrorHandler();
  }

  /**
   * Resolves error handler configuration to a handler function or undefined.
   *
   * @param option - Boolean to enable/disable or custom handler function
   * @param defaultHandler - Default handler to use when option is true
   * @returns Resolved handler function or undefined if disabled
   */
  private resolveErrorHandler<T extends (...args: any[]) => any>(
    option: T | boolean | undefined,
    defaultHandler: T,
  ): T | undefined {
    if (option === false) return undefined;
    if (option === true || option === undefined) return defaultHandler;
    return option;
  }

  /**
   * Registers the global error handler with Hono.
   * Processes errors in order: validation, HTTP response, unknown.
   */
  protected registerErrorHandler(): void {
    this.onError(this.handleError.bind(this));
  }

  /**
   * Safely executes an error handler and returns null if it fails.
   * This allows for graceful fallback to the next handler in the chain.
   *
   * @param handlerFn - Function that executes the error handler
   * @returns Response if successful, null if handler throws
   */
  private async safelyExecuteHandler(
    handlerFn: () => Promise<IHttpResponse> | IHttpResponse,
  ): Promise<Response | null> {
    try {
      const response = await handlerFn();
      return this.adapter.toResponse(response);
    } catch {
      // Handler execution failed, return null to continue to next handler
      return null;
    }
  }

  protected async handleError(
    error: unknown,
    context: Context,
  ): Promise<Response> {
    // Handle validation errors
    if (
      error instanceof RequestValidationError &&
      this.config.errorHandlers.validation
    ) {
      const response = await this.safelyExecuteHandler(() =>
        this.config.errorHandlers.validation!(error, context),
      );
      if (response) return response;
    }

    // Handle HTTP response errors
    if (
      error instanceof HttpResponse &&
      this.config.errorHandlers.httpResponse
    ) {
      const response = await this.safelyExecuteHandler(() =>
        this.config.errorHandlers.httpResponse!(error, context),
      );
      if (response) return response;
    }

    // Handle unknown errors
    if (this.config.errorHandlers.unknown) {
      const response = await this.safelyExecuteHandler(() =>
        this.config.errorHandlers.unknown!(error, context),
      );
      if (response) return response;
    }

    // Default: re-throw
    throw error;
  }

  /**
   * Handles a request with validation and type-safe response conversion.
   *
   * @param context - Hono context for the current request
   * @param validator - Request validator for the specific operation
   * @param handler - Type-safe request handler function
   * @returns Hono-compatible Response object
   */
  protected async handleRequest<
    TRequest extends IHttpRequest,
    TResponse extends IHttpResponse,
  >(
    context: Context,
    validator: IRequestValidator,
    handler: HonoRequestHandler<TRequest, TResponse>,
  ): Promise<Response> {
    try {
      const httpRequest = await this.adapter.toRequest(context);

      // Conditionally validate
      const validatedRequest = this.config.validateRequests
        ? (validator.validate(httpRequest) as TRequest)
        : (httpRequest as TRequest);

      const httpResponse = await handler(validatedRequest, context);
      return this.adapter.toResponse(httpResponse);
    } catch (error) {
      return this.handleError(error, context);
    }
  }
}
