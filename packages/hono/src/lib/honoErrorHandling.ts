import {
  badRequestDefaultError,
  createDefaultErrorBody,
  createDefaultErrorResponse,
  internalServerErrorDefaultError,
  isTypedHttpResponse,
  normalizeHttpResponse,
  RequestValidationError,
  toHttpResponse,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import { HonoBodyParseError } from "./Errors.js";
import type {
  HonoBodyParseErrorHandler,
  HonoHttpResponseErrorHandler,
  HonoRequestValidationErrorHandler,
  HonoResponseValidationErrorHandler,
  HonoUnknownErrorHandler,
} from "./honoTypes.js";
import type { Context } from "hono";

export type HonoErrorHandlers = {
  readonly requestValidation: HonoRequestValidationErrorHandler | undefined;
  readonly bodyParse: HonoBodyParseErrorHandler | undefined;
  readonly responseValidation: HonoResponseValidationErrorHandler | undefined;
  readonly httpResponse: HonoHttpResponseErrorHandler | undefined;
  readonly unknown: HonoUnknownErrorHandler | undefined;
};

export type HonoDefaultErrorHandlers = {
  readonly requestValidation: HonoRequestValidationErrorHandler;
  readonly bodyParse: HonoBodyParseErrorHandler;
  readonly responseValidation: HonoResponseValidationErrorHandler;
  readonly httpResponse: HonoHttpResponseErrorHandler;
  readonly unknown: HonoUnknownErrorHandler;
};

export function createDefaultHonoErrorHandlers(): HonoDefaultErrorHandlers {
  return {
    requestValidation: error => ({
      statusCode: validationDefaultError.statusCode,
      body: {
        ...createDefaultErrorBody(validationDefaultError),
        issues: {
          header: error.headerIssues,
          body: error.bodyIssues,
          query: error.queryIssues,
          param: error.pathParamIssues,
        },
      },
    }),
    responseValidation: () =>
      createDefaultErrorResponse(internalServerErrorDefaultError),
    bodyParse: () => createDefaultErrorResponse(badRequestDefaultError),
    httpResponse: error => toHttpResponse(error),
    unknown: () => createDefaultErrorResponse(internalServerErrorDefaultError),
  };
}

export async function handleHonoError(options: {
  readonly error: unknown;
  readonly context: Context;
  readonly handlers: HonoErrorHandlers;
}): Promise<IHttpResponse> {
  const { error, context, handlers } = options;
  const requestValidationHandler = handlers.requestValidation;
  if (error instanceof RequestValidationError && requestValidationHandler) {
    const response = await safelyExecuteErrorHandler(() =>
      requestValidationHandler(error, context)
    );
    if (response) return response;
  }

  const httpResponseHandler = handlers.httpResponse;
  if (isTypedHttpResponse(error) && httpResponseHandler) {
    const response = await safelyExecuteErrorHandler(() =>
      httpResponseHandler(error, context)
    );
    if (response) return response;
  }

  const unknownHandler = handlers.unknown;
  if (unknownHandler) {
    const response = await safelyExecuteErrorHandler(() =>
      unknownHandler(error, context)
    );
    if (response) return response;
  }

  throw error;
}

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
 * @param options.responseValidator - The response validator for the operation
 * @param options.response - The response to validate
 * @param options.context - The Hono context for the current request
 * @returns The validated (and stripped) response, the handler's response, or the original
 */
export async function validateHonoResponse(options: {
  readonly validateResponses: boolean;
  readonly responseValidator: IResponseValidator;
  readonly response: IHttpResponse;
  readonly context: Context;
  readonly responseValidationHandler:
    | HonoResponseValidationErrorHandler
    | undefined;
  readonly defaultResponseValidationHandler: HonoResponseValidationErrorHandler;
}): Promise<IHttpResponse> {
  const {
    validateResponses,
    responseValidator,
    response,
    context,
    responseValidationHandler,
    defaultResponseValidationHandler,
  } = options;
  if (!validateResponses) return response;

  const result = responseValidator.safeValidate(response);
  if (result.isValid) return normalizeHttpResponse(result.data);
  if (!responseValidationHandler) return response;

  const handlerResponse = await safelyExecuteErrorHandler(() =>
    responseValidationHandler(result.error, response, context)
  );
  if (handlerResponse) return handlerResponse;
  return defaultResponseValidationHandler(result.error, response, context);
}

/**
 * Resolves error handler configuration to a handler function or undefined.
 *
 * @param option - Boolean to enable/disable or custom handler function
 * @param defaultHandler - Default handler to use when option is true or omitted
 * @returns Resolved handler function or undefined if disabled
 */
export function resolveHonoErrorHandler<
  T extends (...args: never[]) => unknown,
>(option: T | boolean | undefined, defaultHandler: T): T | undefined {
  if (option === false) return undefined;
  if (option === true || option === undefined) return defaultHandler;
  return option;
}

/**
 * Safely executes an error handler and returns null if it fails.
 * This allows for graceful fallback to the next handler in the chain
 * without crashing the request pipeline.
 *
 * @param handlerFn - Function that executes the error handler
 * @returns The handler's response if successful, null if the handler throws
 */
export async function safelyExecuteErrorHandler(
  handlerFn: () => Promise<IHttpResponse> | IHttpResponse
): Promise<IHttpResponse | null> {
  try {
    return await handlerFn();
  } catch (error) {
    console.error(
      "TypeweaverHono: error handler threw while handling error",
      error
    );
    return null;
  }
}

export function defaultBodyParseHandler(
  _error?: HonoBodyParseError
): IHttpResponse {
  return createDefaultErrorResponse(badRequestDefaultError);
}
