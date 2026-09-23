import {
  defineOperation,
  HttpMethod,
  RequestValidationError,
  ReservedPathParameterError,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponse,
  createListTodosRequest,
  createTestHono,
  createUpdateTodoRequest,
  MetricHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { expectErrorResponse, prepareRequestData } from "../../../helpers.js";
import {
  createMetricBoundaryHandlers,
  createTodoHonoWithHandlers,
  readContextString,
  requestTestHono,
} from "./fixtures.js";
import type {
  IGetMetricRequest,
  IValidationErrorResponseBody,
} from "test-utils";

describe("Generated Hono request validation", () => {
  test("rejects invalid request body", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        priority: "INVALID_PRIORITY" as never,
      },
    });

    const response = await requestTestHono(
      "http://localhost/todos",
      requestData
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.code).toBe(validationDefaultError.code);
    expect(data.message).toBe(validationDefaultError.message);
    expect(data.issues.body).toHaveLength(1);
  });

  test("rejects invalid request headers", async () => {
    const requestData = createCreateTodoRequest({
      header: {
        "Content-Type": "text/plain" as never,
      },
    });

    const response = await requestTestHono(
      "http://localhost/todos",
      requestData
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.header).toHaveLength(1);
  });

  test("rejects invalid path parameters", async () => {
    const requestData = createUpdateTodoRequest();

    const response = await createTestHono().request(
      "http://localhost/todos/invalid-uuid-format",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.param).toHaveLength(1);
  });

  test("rejects invalid query parameters", async () => {
    const requestData = createListTodosRequest();

    const response = await createTestHono().request(
      "http://localhost/todos?status=INVALID_STATUS",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.query).toHaveLength(1);
  });

  test("bypasses validation when validateRequests is disabled", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        title: "",
      },
    });

    const response = await createTestHono({
      validateRequests: false,
    }).request("http://localhost/todos", prepareRequestData(requestData));

    expect(response.status).toBe(201);
    expect(await response.json()).toBeDefined();
  });
});

describe("Generated Hono request validation handlers", () => {
  test("passes request validation errors and Hono context to custom handlers", async () => {
    let capturedError: unknown;
    let capturedOperationId: string | undefined;
    const app = createTestHono({
      handleRequestValidationErrors: (error, context) => {
        capturedError = error;
        capturedOperationId = readContextString(context, "operationId");
        return {
          statusCode: 422,
          header: {
            "Content-Type": "application/json",
          },
          body: {
            code: "CUSTOM_REQUEST_VALIDATION",
            bodyIssueCount: error.bodyIssues.length,
          },
        };
      },
    });
    const requestData = createCreateTodoRequest({
      body: {
        priority: "INVALID_PRIORITY" as never,
      },
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(422);
    const errorData = (await response.json()) as Record<string, unknown>;
    expect(errorData["code"]).toBe("CUSTOM_REQUEST_VALIDATION");
    expect(errorData["bodyIssueCount"]).toBe(1);
    expect(capturedError).toBeInstanceOf(RequestValidationError);
    expect((capturedError as RequestValidationError).bodyIssues).toHaveLength(
      1
    );
    expect(capturedOperationId).toBe("CreateTodo");
  });

  test("does not invoke route handlers for schema-invalid requests", async () => {
    let handlerInvoked = false;
    const app = createTodoHonoWithHandlers({
      handleCreateTodoRequest: async () => {
        handlerInvoked = true;
        return createCreateTodoSuccessResponse();
      },
    });
    const requestData = createCreateTodoRequest({
      body: {
        priority: "INVALID_PRIORITY" as never,
      },
    });

    const response = await app.request(
      "http://localhost/todos",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as IValidationErrorResponseBody;
    expect(data.issues.body).toHaveLength(1);
    expect(handlerInvoked).toBe(false);
  });
});

describe("Generated Hono typed HTTP boundary coercion", () => {
  test("passes validated domain values to handlers by default", async () => {
    let capturedRequest: IGetMetricRequest | undefined;
    const app = new MetricHono({
      requestHandlers: createMetricBoundaryHandlers(request => {
        capturedRequest = request;
      }),
    });

    const response = await app.request(
      "http://localhost/metrics/42?enabled=false&truthy=false&samples=1.5&samples=2",
      {
        headers: {
          "X-Attempt": "3",
          "X-Enabled": "false",
          "X-Observed-At": "2026-07-26T10:15:30.000Z",
        },
      }
    );

    expect(response.status).toBe(200);
    expect(capturedRequest).toEqual({
      method: "GET",
      path: "/metrics/42",
      param: { metricId: 42 },
      query: {
        enabled: false,
        truthy: true,
        samples: [1.5, 2],
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Observed-At": new Date("2026-07-26T10:15:30.000Z"),
      },
    });
  });

  test("returns a validation error for an invalid coerced path value", async () => {
    const app = new MetricHono({
      requestHandlers: createMetricBoundaryHandlers(),
    });

    const response = await app.request(
      "http://localhost/metrics/not-a-number",
      {
        headers: { "X-Attempt": "3" },
      }
    );

    const data = (await expectErrorResponse(
      response,
      400,
      "VALIDATION_ERROR"
    )) as IValidationErrorResponseBody;
    expect(data.issues.param).toHaveLength(1);
  });
});

describe("Generated Hono reserved record keys", () => {
  test("rejects an own __proto__ record query key", async () => {
    const app = new MetricHono({
      requestHandlers: createMetricBoundaryHandlers(),
    });

    const response = await app.request(
      "http://localhost/metrics/42/labels?__proto__=1"
    );

    const data = (await expectErrorResponse(
      response,
      400,
      "VALIDATION_ERROR"
    )) as IValidationErrorResponseBody;
    expect(data.issues.query).toHaveLength(1);
  });
});

describe("Generated Hono reserved path parameters", () => {
  test("receives the shared ':__proto__' definition rejection", () => {
    const path: string = "/metrics/:__proto__";

    expect(() =>
      defineOperation({
        operationId: "reservedPath",
        method: HttpMethod.GET,
        path,
        summary: "Reserved path parameter",
        request: {},
        responses: [],
      })
    ).toThrow(ReservedPathParameterError);
  });
});
