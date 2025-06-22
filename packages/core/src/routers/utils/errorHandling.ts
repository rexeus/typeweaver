import { HttpResponse, type IHttpResponse } from "../../definition";
import { RequestValidationError } from "../../validation";
import { HttpRouteNotFoundError } from "../HttpRouteNotFoundError";
import type { HttpHandlerOptions } from "./HandlerOptions";

/**
 * Resolves error handling configuration to a normalized format.
 */
export function resolveErrorHandling<TContext>(
  handleErrors: HttpHandlerOptions<TContext>["handleErrors"]
): {
  notFound: boolean;
  validation: boolean;
  httpResponse: boolean;
} {
  if (!handleErrors || handleErrors.mode === "auto") {
    return { notFound: true, validation: true, httpResponse: true };
  }

  if (handleErrors.mode === "throwAll") {
    return { notFound: false, validation: false, httpResponse: false };
  }

  // handleErrors.mode === "custom"
  return {
    notFound: handleErrors.notFound ?? true,
    validation: handleErrors.validation ?? true,
    httpResponse: handleErrors.httpResponse ?? true,
  };
}

/**
 * Creates an error response based on the error type and handling configuration.
 *
 * @param error - The error to handle
 * @param shouldHandle - Configuration for which error types to handle
 * @returns An HTTP response or null if the error should be re-thrown
 */
export function createErrorResponse(
  error: unknown,
  shouldHandle: ReturnType<typeof resolveErrorHandling>
): IHttpResponse | null {
  if (shouldHandle.httpResponse && error instanceof HttpResponse) {
    return error;
  }

  if (shouldHandle.notFound && error instanceof HttpRouteNotFoundError) {
    return {
      statusCode: 404,
      body: {
        error: "Not Found",
        message: error.message,
      },
      header: {
        "content-type": "application/json",
      },
    };
  }

  if (shouldHandle.validation && error instanceof RequestValidationError) {
    return {
      statusCode: 400,
      body: {
        error: "Bad Request",
        message: error.message,
        issues: {
          header: error.headerIssues,
          body: error.bodyIssues,
          query: error.queryIssues,
          path: error.pathParamIssues,
        },
      },
      header: {
        "content-type": "application/json",
      },
    };
  }

  return null;
}
