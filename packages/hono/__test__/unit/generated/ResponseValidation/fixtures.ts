import {
  internalServerErrorDefaultError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { expect } from "vitest";
import {
  createTodoApiHandlers,
  expectErrorResponse,
  prepareRequestData,
  readJsonRecord,
  UncheckedResponseTodoHono,
} from "../../../helpers.js";
import type {
  HonoResponseValidationErrorHandler,
  HonoTodoApiHandler,
} from "test-utils";

export type TodoHonoTestOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests"
> & { readonly validateRequests?: false };

export type CapturedResponseValidationCall = {
  readonly error: ResponseValidationError;
  readonly response: IHttpResponse;
  readonly operationId: unknown;
};

export function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return new TodoHono<false>({
    validateRequests: false,
    validateResponses: true,
    ...options,
    requestHandlers: createTodoApiHandlers<false>(handlers),
  });
}

/**
 * Builds the generated router with one operation returning `response`, which
 * may lie outside that operation's response contract.
 */
export function createTodoRouteReturning(
  operationId: string,
  response: IHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return new UncheckedResponseTodoHono<false>(
    {
      validateRequests: false,
      validateResponses: true,
      ...options,
      requestHandlers: createTodoApiHandlers<false>({}),
    },
    { [operationId]: async () => response }
  );
}

export function createCreateTodoRouteReturning(
  response: IHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoRouteReturning("CreateTodo", response, options);
}

export async function requestCreateTodo(
  app: TodoHono<false>
): Promise<Response> {
  return await app.request(
    "http://localhost/todos",
    prepareRequestData(createCreateTodoRequest())
  );
}

export async function expectJson(
  response: Response,
  status: number
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);
  return await readJsonRecord(response);
}

export async function expectSanitizedInternalServerError(
  response: Response
): Promise<Record<string, unknown>> {
  const data = await expectErrorResponse(
    response,
    internalServerErrorDefaultError.statusCode,
    internalServerErrorDefaultError.code
  );
  expect(data).toEqual({
    code: internalServerErrorDefaultError.code,
    message: internalServerErrorDefaultError.message,
  });

  return data;
}

export function captureResponseValidationHandlerCall(
  responseFactory: () => IHttpResponse = () => ({
    statusCode: 502,
    body: { code: "CUSTOM_VALIDATION_FAILURE" },
  })
): {
  readonly handler: HonoResponseValidationErrorHandler;
  readonly getCapturedCall: () => CapturedResponseValidationCall;
} {
  let capturedCall: CapturedResponseValidationCall | undefined;

  return {
    handler: (error, response, context) => {
      capturedCall = {
        error,
        response,
        operationId: context.get("operationId"),
      };

      return responseFactory();
    },
    getCapturedCall: () => {
      if (capturedCall === undefined) {
        throw new TestAssertionError(
          "Expected response-validation handler to be called"
        );
      }

      return capturedCall;
    },
  };
}
