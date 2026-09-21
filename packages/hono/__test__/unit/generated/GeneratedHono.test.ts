import type { IValidatedHttpRequest } from "@rexeus/typeweaver-core";
import {
  createCreateSubTodoRequest,
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createGetMetricSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricKeyedLabelsSuccessResponse,
  createHeadTodoRequest,
  createListTodosRequest,
  createOptionsTodoRequest,
  createPutTodoRequest,
  createQueryTodoRequest,
  createQueryTodoSuccessResponse,
  createTestHono,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
  MetricHono,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { expectErrorResponse, prepareRequestData } from "../../helpers.js";
import type {
  HonoMetricApiHandler,
  HonoTodoApiHandler,
  IGetMetricRequest,
  IValidationErrorResponseBody,
} from "test-utils";

type CreateTestHonoOptions = Parameters<typeof createTestHono>[0];

type UnvalidatedTodoHonoOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests" | "validateResponses"
>;

const readContextString = (
  context: { get: (key: string) => unknown },
  key: string
): string | undefined => {
  const value = context.get(key);
  return typeof value === "string" ? value : undefined;
};

async function requestTestHono(
  url: string,
  requestData: IValidatedHttpRequest,
  options?: CreateTestHonoOptions
): Promise<Response> {
  return await createTestHono(options).request(
    url,
    prepareRequestData(requestData)
  );
}

function createRequestHandlersProxy<TValidateRequests extends boolean>(
  handlers: Partial<HonoTodoApiHandler<TValidateRequests>>
): HonoTodoApiHandler<TValidateRequests> {
  return new Proxy(handlers as HonoTodoApiHandler<TValidateRequests>, {
    get: (target, prop) => {
      if (prop in target)
        return target[prop as keyof HonoTodoApiHandler<TValidateRequests>];
      return async () => {
        throw new TestAssertionError(
          `Missing Hono test handler: ${String(prop)}`
        );
      };
    },
  });
}

function createUnvalidatedTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options: UnvalidatedTodoHonoOptions = {}
): TodoHono<false> {
  return new TodoHono<false>({
    ...options,
    validateRequests: false,
    validateResponses: false,
    requestHandlers: createRequestHandlersProxy<false>(handlers),
  });
}

function createMetricBoundaryHandlers(
  onRequest?: (request: IGetMetricRequest) => void
): HonoMetricApiHandler<true> {
  return {
    handleGetMetricRequest: async request => {
      onRequest?.(request);
      return createGetMetricSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          enabled: request.query.enabled ?? false,
        },
      });
    },
    handleGetMetricLabelsRequest: async request =>
      createGetMetricLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          labels: request.query ?? {},
          flags: request.header ?? {},
        },
      }),
    handleGetMetricSamplesRequest: async request =>
      createGetMetricSamplesSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          samples: request.query ?? {},
        },
      }),
    handleGetMetricKeyedLabelsRequest: async request =>
      createGetMetricKeyedLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: {
          metricId: request.param.metricId,
          labels: request.query ?? {},
        },
      }),
  };
}

describe("Generated Hono route dispatch", () => {
  test("dispatches GET /todos to the list operation", async () => {
    const requestData = createListTodosRequest();

    const response = await requestTestHono(
      "http://localhost/todos?status=TODO",
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["results"]).toHaveLength(2);
    expect(data["nextToken"]).toEqual(expect.any(String));
  });

  test("dispatches POST /todos with the validated request body", async () => {
    const requestData = createCreateTodoRequest({
      body: {
        title: "ship hono hardening",
        priority: "HIGH",
      },
    });

    const response = await requestTestHono(
      "http://localhost/todos",
      requestData
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["title"]).toBe("ship hono hardening");
    expect(data["priority"]).toBe("HIGH");
    expect(data["status"]).toBe("TODO");
  });

  test("dispatches PUT /todos/:todoId with path params and body fields", async () => {
    const requestData = createPutTodoRequest({
      body: {
        title: "replace todo",
        priority: "LOW",
        status: "IN_PROGRESS",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("replace todo");
    expect(data["priority"]).toBe("LOW");
    expect(data["status"]).toBe("IN_PROGRESS");
  });

  test("dispatches PATCH /todos/:todoId with path params and body fields", async () => {
    const requestData = createUpdateTodoRequest({
      body: {
        title: "patch todo",
        priority: "MEDIUM",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("patch todo");
    expect(data["priority"]).toBe("MEDIUM");
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

describe("Generated Hono todo route precedence", () => {
  test("dispatches PUT /todos/:todoId/status with the requested status", async () => {
    const requestData = createUpdateTodoStatusRequest({
      body: { value: "DONE" },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}/status`,
      requestData
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["status"]).toBe("DONE");
  });

  test("dispatches DELETE /todos/:todoId as a 204 empty response", async () => {
    const requestData = createDeleteTodoRequest();

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  test("dispatches OPTIONS /todos/:todoId and preserves the Allow header", async () => {
    const requestData = createOptionsTodoRequest();

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Allow")).toBe(
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  });

  test("returns 200 with an empty body for HEAD /todos/:todoId", async () => {
    const requestData = createHeadTodoRequest();

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}`,
      requestData
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  test("static todo query route wins over the dynamic todo route", async () => {
    let capturedOperationId: string | undefined;
    const requestData = createQueryTodoRequest();
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async (_request, context) => {
        capturedOperationId = readContextString(context, "operationId");
        return createQueryTodoSuccessResponse({ body: { results: [] } });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query",
      prepareRequestData(requestData)
    );

    expect(response.status).toBe(200);
    expect(capturedOperationId).toBe("QueryTodo");
  });

  test("nested subtodo create routes propagate parent ids and body fields", async () => {
    const requestData = createCreateSubTodoRequest({
      body: {
        title: "create nested item",
        priority: "HIGH",
      },
    });

    const response = await requestTestHono(
      `http://localhost/todos/${requestData.param.todoId}/subtodos`,
      requestData
    );

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("create nested item");
    expect(data["priority"]).toBe("HIGH");
  });
});
