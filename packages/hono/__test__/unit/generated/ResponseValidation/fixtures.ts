import {
  internalServerErrorDefaultError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { expect } from "vitest";
import { expectErrorResponse, prepareRequestData } from "../../../helpers.js";
import type {
  CreateTodoResponse,
  HonoResponseValidationErrorHandler,
  HonoTodoApiHandler,
} from "test-utils";

export type TodoHonoTestOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests"
> & { readonly validateRequests?: false };

export type CapturedResponseValidationCall = {
  readonly error: ResponseValidationError;
  readonly response: ITypedHttpResponse;
  readonly operationId: unknown;
};

export const unhandledHonoTodoRequest = async (
  handlerName: string
): Promise<never> => {
  throw new TestAssertionError(`Missing Hono test handler: ${handlerName}`);
};

export function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  const requestHandlers = new Proxy(handlers as HonoTodoApiHandler<false>, {
    get: (target, prop) => {
      if (prop in target)
        return target[prop as keyof HonoTodoApiHandler<false>];
      return async () => unhandledHonoTodoRequest(String(prop));
    },
  });

  return new TodoHono<false>({
    validateRequests: false,
    validateResponses: true,
    ...options,
    requestHandlers,
  });
}

export function createCreateTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoHonoWithHandlers(
    {
      handleCreateTodoRequest: async () => response as CreateTodoResponse,
    },
    options
  );
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
  return (await response.json()) as Record<string, unknown>;
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
        response: response as ITypedHttpResponse,
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
