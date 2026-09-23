import type {
  IHttpResponse,
  IRawHttpRequest,
  IRequestValidator,
  IResponseValidator,
  ITypedHttpResponse,
  IValidatedHttpRequest,
  RequestValidationError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { HonoBodyParseError } from "./Errors.js";
import type { HonoRequestHandler } from "./HonoRequestHandler.js";
import type { Context } from "hono";
import type { HonoOptions } from "hono/hono-base";
import type { BlankEnv, Env } from "hono/types";

/**
 * Handles HTTP response errors thrown by request handlers.
 * @param error - The HTTP response error that was thrown
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type HonoHttpResponseErrorHandler = (
  error: ITypedHttpResponse,
  context: Context
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles request validation errors.
 * @param error - The validation error containing field-specific issues
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type HonoRequestValidationErrorHandler = (
  error: RequestValidationError,
  context: Context
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles request body parse errors.
 * @param error - The body parse error thrown while reading the request body
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type HonoBodyParseErrorHandler = (
  error: HonoBodyParseError,
  context: Context
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles any unknown errors not caught by other handlers.
 * @param error - The unknown error (could be anything)
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client
 */
export type HonoUnknownErrorHandler = (
  error: unknown,
  context: Context
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles response validation errors.
 * Called when a handler returns a response that does not match the expected schema.
 * @param error - The response validation error with schema mismatch details
 * @param response - The original (invalid) response from the handler
 * @param context - The Hono context for the current request
 * @returns The HTTP response to send to the client (typically a 500)
 */
export type HonoResponseValidationErrorHandler = (
  error: ResponseValidationError,
  response: IHttpResponse,
  context: Context
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Makes `validateRequests` mandatory when the router cannot statically
 * guarantee which request shape reaches a handler.
 *
 * A literal `false` always receives raw requests and a dynamic `boolean` may
 * receive either shape, so the caller must state the mode explicitly. The
 * default and literal `true` modes keep the option optional because omitting
 * it means validated requests at runtime.
 */
type RequireExplicitValidation<TValidateRequests extends boolean> = [
  TValidateRequests,
] extends [true]
  ? unknown
  : { readonly validateRequests: TValidateRequests };

/**
 * Configuration options for TypeweaverHono routers.
 * @template RequestHandlers - Type containing all request handler methods
 * @template HonoEnv - Hono environment type for middleware context
 * @template TValidateRequests - Request validation mode; defaults to `true`
 */
export type TypeweaverHonoOptions<
  RequestHandlers,
  HonoEnv extends Env = BlankEnv,
  TValidateRequests extends boolean = true,
> = HonoOptions<HonoEnv> & {
  /**
   * Request handler methods for each operation.
   * Each handler receives a request whose shape matches the validation mode.
   */
  readonly requestHandlers: RequestHandlers;
  /**
   * Enable request validation using generated validators.
   * When false, requests are passed through without validation.
   * Required when the router is specialized as `false` or `boolean` so the
   * handler request type always matches runtime behavior.
   * @default true
   */
  readonly validateRequests?: TValidateRequests;
  /**
   * Enable response validation using generated validators.
   * When true, responses are validated and stripped of extra fields before sending.
   * @default true
   */
  readonly validateResponses?: boolean;
  /**
   * Configure handling of request validation errors.
   * - `true`: Use the default handler (400 with error details)
   * - `false`: Let errors bubble up to Hono
   * - `function`: Use a custom request validation error handler
   * @default true
   */
  readonly handleRequestValidationErrors?:
    | HonoRequestValidationErrorHandler
    | boolean;
  /**
   * Configure handling of request body parse errors.
   * - `true`: Use the default sanitized 400 Bad Request handler
   * - `false`: Let errors flow to the unknown error handler or bubble to Hono
   * - `function`: Use a custom body parse error handler
   * @default true
   */
  readonly handleBodyParseErrors?: HonoBodyParseErrorHandler | boolean;
  /**
   * Configure handling of response validation errors.
   * - `true`: Use the default 500 Internal Server Error handler
   * - `false`: Disable response validation error handling (return the
   *   response as-is)
   * - `function`: Use a custom response validation error handler
   * @default true
   */
  readonly handleResponseValidationErrors?:
    | HonoResponseValidationErrorHandler
    | boolean;
  /**
   * Configure handling of HTTP response errors thrown by handlers.
   * - `true`: Use the default handler, which returns the error as-is
   * - `false`: Let errors bubble up to Hono
   * - `function`: Use a custom error handler
   * @default true
   */
  readonly handleHttpResponseErrors?: HonoHttpResponseErrorHandler | boolean;
  /**
   * Configure handling of unknown errors.
   * - `true`: Use the default 500 Internal Server Error handler
   * - `false`: Let errors bubble up to Hono
   * - `function`: Use a custom unknown error handler
   * @default true
   */
  readonly handleUnknownErrors?: HonoUnknownErrorHandler | boolean;
} & RequireExplicitValidation<TValidateRequests>;

/**
 * Inputs used by generated and custom Hono routers to handle one operation.
 */
export type TypeweaverHonoRequestOptions<
  TRequest extends IRawHttpRequest | IValidatedHttpRequest,
  TResponse extends IHttpResponse,
> = {
  readonly context: Context;
  readonly operationId: string;
  readonly requestValidator: IRequestValidator<IValidatedHttpRequest>;
  readonly responseValidator: IResponseValidator;
  readonly handler: HonoRequestHandler<TRequest, TResponse>;
};
