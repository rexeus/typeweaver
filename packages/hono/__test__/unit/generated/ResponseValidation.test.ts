import assert from "node:assert";
import {
  HttpStatusCode,
  internalServerErrorDefaultError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  TestApplicationError,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  aCreateTodoSuccessResponseWithBody,
  buildCreateTodoSuccess,
  expectErrorResponse,
  prepareRequestData,
} from "../../helpers.js";
import type {
  CreateTodoResponse,
  HonoResponseValidationErrorHandler,
  HonoTodoApiHandler,
} from "test-utils";

type TodoHonoTestOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests"
> & { readonly validateRequests?: false };

type CapturedResponseValidationCall = {
  readonly error: ResponseValidationError;
  readonly response: ITypedHttpResponse;
  readonly operationId: unknown;
};

const unhandledHonoTodoRequest = async (
  handlerName: string
): Promise<never> => {
  throw new TestAssertionError(`Missing Hono test handler: ${handlerName}`);
};

function createTodoHonoWithHandlers(
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

function createCreateTodoRouteReturning(
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

async function requestCreateTodo(app: TodoHono<false>): Promise<Response> {
  return await app.request(
    "http://localhost/todos",
    prepareRequestData(createCreateTodoRequest())
  );
}

async function expectJson(
  response: Response,
  status: number
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);
  return (await response.json()) as Record<string, unknown>;
}

async function expectSanitizedInternalServerError(
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

function captureResponseValidationHandlerCall(
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

describe("returned response body validation", () => {
  test("strips extra body fields from a valid returned response", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-be-stripped",
      anotherExtra: 42,
    });
    const app = createCreateTodoRouteReturning(responseWithExtra);

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data).not.toHaveProperty("anotherExtra");
    expect(data["id"]).toBe(responseWithExtra.body.id);
    expect(data["title"]).toBe(responseWithExtra.body.title);
  });

  test("returns a sanitized 500 when a returned response body has invalid field types", async () => {
    const invalidResponse = aCreateTodoSuccessResponseWithBody({
      id: 12345,
      title: true,
      secret: "response-secret",
    });
    const app = createCreateTodoRouteReturning(invalidResponse);

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    const serializedError = JSON.stringify(data);
    expect(serializedError).not.toContain("response-secret");
    expect(serializedError).not.toContain("12345");
  });

  test.each([
    { scenario: "undefined", body: undefined },
    { scenario: "null", body: null },
    { scenario: "empty object", body: {} },
  ])(
    "returns a sanitized 500 when a returned response body is $scenario",
    async ({ body }) => {
      const app = createCreateTodoRouteReturning(
        aCreateTodoSuccessResponseWithBody(body)
      );

      const response = await requestCreateTodo(app);

      await expectSanitizedInternalServerError(response);
    }
  );
});

describe("returned response header validation", () => {
  test("strips unknown response headers after validation", async () => {
    const responseWithUnknownHeader: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "Content-Type": "application/json",
        "X-Trace-Id": "trace-1",
      },
    };
    const app = createCreateTodoRouteReturning(responseWithUnknownHeader);

    const response = await requestCreateTodo(app);

    await expectJson(response, 201);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-trace-id")).toBeNull();
  });

  test("coerces schema response headers before serialization", async () => {
    const responseWithCoercibleHeaders: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "content-type": "application/json",
        "X-Single-Value": ["single"],
        "X-Multi-Value": "first, second",
      },
    };
    const app = createCreateTodoRouteReturning(responseWithCoercibleHeaders);

    const response = await requestCreateTodo(app);

    await expectJson(response, 201);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-single-value")).toBe("single");
    expect(response.headers.get("x-multi-value")).toBe("first, second");
  });

  test("returns a sanitized 500 when a required response header is invalid", async () => {
    const responseWithInvalidHeader: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: { "Content-Type": "text/plain" },
    };
    const app = createCreateTodoRouteReturning(responseWithInvalidHeader);

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    expect(JSON.stringify(data)).not.toContain("text/plain");
  });
});

describe("response status validation", () => {
  test("returns a sanitized 500 when a returned response has an unrecognized status code", async () => {
    const unknownStatusResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 299 as HttpStatusCode,
      header: { "Content-Type": "application/json" },
      body: { message: "unexpected" },
    };
    const app = createCreateTodoRouteReturning(unknownStatusResponse);

    const response = await requestCreateTodo(app);

    await expectSanitizedInternalServerError(response);
  });

  test("passes status validation details to a custom response-validation handler", async () => {
    const { handler, getCapturedCall } = captureResponseValidationHandlerCall();
    const unknownStatusResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 299 as HttpStatusCode,
      header: { "Content-Type": "application/json" },
      body: { message: "unexpected" },
    };
    const app = createCreateTodoRouteReturning(unknownStatusResponse, {
      handleResponseValidationErrors: handler,
    });

    const response = await requestCreateTodo(app);

    await expectJson(response, 502);
    const capturedCall = getCapturedCall();
    assert(capturedCall.error instanceof ResponseValidationError);
    const statusIssue = capturedCall.error.issues.find(
      issue => issue.type === "INVALID_STATUS_CODE"
    );
    assert(statusIssue?.type === "INVALID_STATUS_CODE");
    expect(statusIssue.invalidStatusCode).toBe(299);
    expect(statusIssue.expectedStatusCodes).toEqual([
      201, 400, 401, 403, 415, 429, 500,
    ]);
    expect(capturedCall.operationId).toBe("CreateTodo");
  });
});

describe("custom response-validation handlers", () => {
  test("passes normalized invalid responses and Hono context to custom handlers", async () => {
    const invalidBody = { id: 12345, title: true };
    const { handler, getCapturedCall } = captureResponseValidationHandlerCall();
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: {
        "Content-Type": "application/json",
        "X-Single-Value": "defined",
        "X-Multi-Value": undefined,
        "X-Trace-Id": "trace-1",
      },
      body: invalidBody,
    };
    const app = createCreateTodoRouteReturning(invalidResponse, {
      handleResponseValidationErrors: handler,
    });

    const response = await requestCreateTodo(app);

    await expectJson(response, 502);
    const capturedCall = getCapturedCall();
    assert(capturedCall.error instanceof ResponseValidationError);
    expect(capturedCall.response).not.toHaveProperty("type");
    expect(capturedCall.response.header).toEqual({
      "Content-Type": "application/json",
      "X-Single-Value": "defined",
      "X-Trace-Id": "trace-1",
    });
    expect(capturedCall.response.body).toEqual(invalidBody);
    expect(capturedCall.operationId).toBe("CreateTodo");
  });

  test("returns the custom handler response to the client", async () => {
    const handler: HonoResponseValidationErrorHandler = () => ({
      statusCode: 503,
      header: { "X-Custom": "response-validation" },
      body: { reason: "schema mismatch" },
    });
    const app = createCreateTodoRouteReturning(
      aCreateTodoSuccessResponseWithBody({ id: 999 }),
      { handleResponseValidationErrors: handler }
    );

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 503);
    expect(data["reason"]).toBe("schema mismatch");
    expect(response.headers.get("x-custom")).toBe("response-validation");
  });

  test("fails closed with a sanitized 500 when the custom handler throws", async () => {
    const handler: HonoResponseValidationErrorHandler = () => {
      throw new TestApplicationError("handler crashed");
    };
    const app = createCreateTodoRouteReturning(
      aCreateTodoSuccessResponseWithBody({
        id: 12345,
        secret: "handler-throw-secret",
      }),
      { handleResponseValidationErrors: handler }
    );

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    expect(JSON.stringify(data)).not.toContain("handler-throw-secret");
  });

  test("fails closed with a sanitized 500 when the custom handler rejects", async () => {
    const handler: HonoResponseValidationErrorHandler = async () => {
      throw new TestApplicationError("async handler crashed");
    };
    const app = createCreateTodoRouteReturning(
      aCreateTodoSuccessResponseWithBody({
        id: 12345,
        secret: "handler-reject-secret",
      }),
      { handleResponseValidationErrors: handler }
    );

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    expect(JSON.stringify(data)).not.toContain("handler-reject-secret");
  });
});
