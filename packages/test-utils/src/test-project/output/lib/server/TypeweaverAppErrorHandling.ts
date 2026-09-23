import {
  createDefaultErrorBody,
  createDefaultErrorResponse,
  internalServerErrorDefaultError,
  isTypedHttpResponse,
  normalizeHttpResponse,
  RequestValidationError,
  toHttpResponse,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import type {
  HttpResponseErrorHandler,
  RequestValidationErrorHandler,
  ResponseValidationErrorHandler,
  RouteDefinition,
  UnknownErrorHandler,
} from "./Router.js";
import type { ServerContext } from "./ServerContext.js";

const INTERNAL_SERVER_ERROR_BODY = createDefaultErrorBody(internalServerErrorDefaultError);

export function reportAppError(onError: (error: unknown) => void, error: unknown): void {
  try {
    onError(error);
  } catch (onErrorFailure) {
    console.error("TypeweaverApp: onError callback threw while handling error", {
      onErrorFailure,
      originalError: error,
    });
  }
}

export function createInternalServerErrorResponse(): Response {
  return new Response(JSON.stringify(INTERNAL_SERVER_ERROR_BODY), {
    status: internalServerErrorDefaultError.statusCode,
    headers: { "content-type": "application/json" },
  });
}

export const defaultRequestValidationHandler: RequestValidationErrorHandler = (
  error,
): IHttpResponse => {
  const issues: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const header = sanitizeIssues(error.headerIssues);
  const body = sanitizeIssues(error.bodyIssues);
  const query = sanitizeIssues(error.queryIssues);
  const param = sanitizeIssues(error.pathParamIssues);

  if (header) issues["header"] = header;
  if (body) issues["body"] = body;
  if (query) issues["query"] = query;
  if (param) issues["param"] = param;

  return {
    statusCode: validationDefaultError.statusCode,
    body: { ...createDefaultErrorBody(validationDefaultError), issues },
  };
};

export const defaultResponseValidationHandler: ResponseValidationErrorHandler = (): IHttpResponse =>
  createDefaultErrorResponse(internalServerErrorDefaultError);

export const defaultHttpResponseHandler: HttpResponseErrorHandler = (err) => toHttpResponse(err);

export const defaultUnknownHandler: UnknownErrorHandler = (): IHttpResponse => ({
  statusCode: internalServerErrorDefaultError.statusCode,
  body: INTERNAL_SERVER_ERROR_BODY,
});

/**
 * Validates a response against the operation's response validator.
 *
 * Behavior depends on configuration:
 * - `validateResponses: false` → returns the original response unchanged.
 * - `validateResponses: true` (default) → runs validation:
 *   - Valid response → returns the stripped response (extra fields removed).
 *   - Invalid response + handler configured → calls the handler safely.
 *     If the handler throws, fails closed with a sanitized 500 response.
 *   - Invalid response + `handleResponseValidationErrors: false` → returns
 *     the original (invalid) response as-is.
 *
 * @param options.route - The route definition containing the response validator and config
 * @param options.response - The response to validate
 * @param options.ctx - The server context for the current request
 * @param options.safeOnError - Reports an error thrown by the configured handler
 * @returns The validated (and stripped) response, the handler's response, or the original
 */
export async function validateAppResponse(options: {
  readonly route: RouteDefinition;
  readonly response: IHttpResponse;
  readonly ctx: ServerContext;
  readonly safeOnError: (error: unknown) => void;
}): Promise<IHttpResponse> {
  const { route, response, ctx, safeOnError } = options;
  if (!route.routerConfig.validateResponses) return response;

  const result = route.responseValidator.safeValidate(response);
  if (result.isValid) return normalizeHttpResponse(result.data);

  const handler = resolveErrorHandler(
    route.routerConfig.handleResponseValidationErrors,
    defaultResponseValidationHandler,
  );
  if (!handler) return response;

  const handlerResponse = await safelyExecuteErrorHandler(
    () => handler(result.error, response, ctx),
    safeOnError,
  );
  if (handlerResponse) return handlerResponse;
  return defaultResponseValidationHandler(result.error, response, ctx);
}

/**
 * Handle errors using the route's configured error handlers.
 * Processes errors in order: request validation, HTTP response, unknown.
 * Rethrows the original error when no enabled handler produces a response.
 */
export async function handleAppError(options: {
  readonly error: unknown;
  readonly ctx: ServerContext;
  readonly route: RouteDefinition;
  readonly safeOnError: (error: unknown) => void;
  readonly validateResponse: (
    route: RouteDefinition,
    response: IHttpResponse,
    ctx: ServerContext,
  ) => Promise<IHttpResponse>;
}): Promise<IHttpResponse> {
  const { error, ctx, route, safeOnError, validateResponse } = options;
  const config = route.routerConfig;

  const validationResponse = await handleRequestValidationError(error, config, ctx, safeOnError);
  if (validationResponse) return validationResponse;

  const httpResponse = await handleHttpResponseError({
    error,
    config,
    ctx,
    route,
    validateResponse,
    safeOnError,
  });
  if (httpResponse) return httpResponse;

  const unknownResponse = await handleUnknownError(error, config, ctx, safeOnError);
  if (unknownResponse) return unknownResponse;

  throw error;
}

async function handleRequestValidationError(
  error: unknown,
  config: RouteDefinition["routerConfig"],
  ctx: ServerContext,
  safeOnError: (error: unknown) => void,
): Promise<IHttpResponse | null> {
  if (!(error instanceof RequestValidationError)) return null;
  const handler = resolveErrorHandler(
    config.handleRequestValidationErrors,
    defaultRequestValidationHandler,
  );
  return handler ? safelyExecuteErrorHandler(() => handler(error, ctx), safeOnError) : null;
}

async function handleHttpResponseError(options: {
  readonly error: unknown;
  readonly config: RouteDefinition["routerConfig"];
  readonly ctx: ServerContext;
  readonly route: RouteDefinition;
  readonly validateResponse: (
    route: RouteDefinition,
    response: IHttpResponse,
    ctx: ServerContext,
  ) => Promise<IHttpResponse>;
  readonly safeOnError: (error: unknown) => void;
}): Promise<IHttpResponse | null> {
  const { error, config, ctx, route, validateResponse, safeOnError } = options;
  if (!isTypedHttpResponse(error)) return null;
  const handler = resolveErrorHandler(config.handleHttpResponseErrors, defaultHttpResponseHandler);
  if (!handler) return null;
  const response = await safelyExecuteErrorHandler(() => handler(error, ctx), safeOnError);
  return response ? validateResponse(route, normalizeHttpResponse(response), ctx) : null;
}

async function handleUnknownError(
  error: unknown,
  config: RouteDefinition["routerConfig"],
  ctx: ServerContext,
  safeOnError: (error: unknown) => void,
): Promise<IHttpResponse | null> {
  const handler = resolveErrorHandler(config.handleUnknownErrors, defaultUnknownHandler);
  if (!handler) return null;
  const response = await safelyExecuteErrorHandler(() => handler(error, ctx), safeOnError);
  if (!response) return null;
  safeOnError(error);
  return response;
}

function resolveErrorHandler<T extends (...args: never[]) => unknown>(
  option: T | boolean | undefined,
  defaultHandler: T,
): T | undefined {
  if (option === false) return undefined;
  if (option === true || option === undefined) return defaultHandler;
  return option;
}

/**
 * Safely executes an error handler and returns null if it fails.
 * This allows for graceful fallback to the next handler in the chain
 * without crashing the request pipeline.
 *
 * If the handler throws, the error is reported via `safeOnError`
 * and null is returned so the caller can fall through to the next handler.
 *
 * @param handlerFn - Function that executes the error handler
 * @returns The handler's response if successful, null if the handler throws
 */
async function safelyExecuteErrorHandler(
  handlerFn: () => Promise<IHttpResponse> | IHttpResponse,
  safeOnError: (error: unknown) => void,
): Promise<IHttpResponse | null> {
  try {
    return await handlerFn();
  } catch (error) {
    safeOnError(error);
    return null;
  }
}

function sanitizeIssues(
  issues: readonly {
    readonly message: string;
    readonly path: PropertyKey[];
  }[],
): readonly { message: string; path: PropertyKey[] }[] | undefined {
  if (issues.length === 0) return undefined;
  return issues.map(({ message, path }) => ({ message, path }));
}
