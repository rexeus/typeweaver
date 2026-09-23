import type {
  HttpMethod,
  IHttpResponse,
  IRequestValidator,
  IResponseValidator,
  IValidatedHttpRequest,
  ITypedHttpResponse,
  RequestValidationError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { ErasedRequestHandler } from "./RequestHandler.js";
import type { ServerContext } from "./ServerContext.js";

/**
 * Metadata about a matched route, available in middleware and handlers via `ctx.route`.
 */
export type RouteMetadata = {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
};

/**
 * A registered route with its method, path pattern, validator, and handler.
 */
export type RouteDefinition = {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly requestValidator: IRequestValidator<IValidatedHttpRequest>;
  readonly responseValidator: IResponseValidator;
  readonly handler: ErasedRequestHandler;
  /** Reference to the router config for error handling. */
  readonly routerConfig: RouterErrorConfig;
};

/**
 * Error handling configuration associated with a router.
 */
export type RouterErrorConfig = {
  readonly validateRequests: boolean;
  readonly validateResponses: boolean;
  readonly handleHttpResponseErrors: HttpResponseErrorHandler | boolean;
  readonly handleRequestValidationErrors:
    | RequestValidationErrorHandler
    | boolean;
  readonly handleResponseValidationErrors:
    | ResponseValidationErrorHandler
    | boolean;
  readonly handleUnknownErrors: UnknownErrorHandler | boolean;
};

/**
 * Handles HTTP response errors thrown by request handlers.
 * The error parameter is a typed HTTP response object (thrown via `throw { type, statusCode, ... }`).
 */
export type HttpResponseErrorHandler = (
  error: ITypedHttpResponse,
  ctx: ServerContext
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles request validation errors.
 */
export type RequestValidationErrorHandler = (
  error: RequestValidationError,
  ctx: ServerContext
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles response validation errors.
 * Called when a handler returns a response that does not match the expected schema.
 */
export type ResponseValidationErrorHandler = (
  error: ResponseValidationError,
  response: IHttpResponse,
  ctx: ServerContext
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Handles any unknown errors not caught by other handlers.
 */
export type UnknownErrorHandler = (
  error: unknown,
  ctx: ServerContext
) => Promise<IHttpResponse> | IHttpResponse;

/**
 * Result of a successful route match.
 */
export type RouteMatch = {
  readonly route: RouteDefinition;
  readonly params: Record<string, string>;
};
