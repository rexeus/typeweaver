import {
  createCreateSubTodoRequest,
  createCreateTodoRequest,
  createDeleteSubTodoRequest,
  createGetTodoRequest,
  createGetMetricSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricKeyedLabelsSuccessResponse,
  createListSubTodosRequest,
  createPutTodoRequest,
  createQuerySubTodoRequest,
  createQueryTodoRequest,
  createTestApp,
  createUpdateSubTodoRequest,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
  MetricRouter,
  TypeweaverApp,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
} from "../../helpers.js";
import type {
  IGetMetricRequest,
  IValidationErrorResponseBody,
  ServerMetricApiHandler,
} from "test-utils";

async function expectValidationIssue(
  response: Response,
  issueKey: keyof IValidationErrorResponseBody["issues"]
): Promise<void> {
  const data = (await expectErrorResponse(
    response,
    400,
    "VALIDATION_ERROR"
  )) as IValidationErrorResponseBody;
  expect(data["issues"][issueKey]).toHaveLength(1);
}

function createMetricBoundaryHandlers(
  onRequest?: (request: IGetMetricRequest) => void
): ServerMetricApiHandler<Record<string, unknown>, true> {
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

describe("Generated Server request bodies and parameters", () => {
  test("returns request body fields from the create todo route", async () => {
    const app = createTestApp();
    const requestData = createCreateTodoRequest({
      body: { title: "Write generated server tests", priority: "HIGH" },
    });

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data["title"]).toBe("Write generated server tests");
    expect(data["priority"]).toBe("HIGH");
    expect(data["status"]).toBe("TODO");
  });

  test("merges route params into the replace todo response", async () => {
    const app = createTestApp();
    const requestData = createPutTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { title: "Replace from route params" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("Replace from route params");
  });

  test("merges route params and body into the update todo response", async () => {
    const app = createTestApp();
    const requestData = createUpdateTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { title: "Patch from route params" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("Patch from route params");
  });

  test("returns the requested todo status update", async () => {
    const app = createTestApp();
    const requestData = createUpdateTodoStatusRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { value: "DONE" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/status`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe(requestData.param.todoId);
    expect(data["status"]).toBe("DONE");
  });

  test("returns the decoded nextToken from the query todo request", async () => {
    const app = createTestApp();
    const requestData = createQueryTodoRequest({
      query: { nextToken: "runtime query+token" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/query?nextToken=runtime%20query%2Btoken`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["nextToken"]).toBe("runtime query+token");
  });
});

describe("Generated Server typed HTTP boundary coercion", () => {
  test("passes validated domain values to handlers by default", async () => {
    let capturedRequest: IGetMetricRequest | undefined;
    const app = new TypeweaverApp().route(
      new MetricRouter({
        requestHandlers: createMetricBoundaryHandlers(request => {
          capturedRequest = request;
        }),
      })
    );

    const response = await app.fetch(
      new Request(
        `${BASE_URL}/metrics/42?enabled=false&truthy=false&samples=1.5&samples=2`,
        {
          headers: {
            "X-Attempt": "3",
            "X-Enabled": "false",
            "X-Observed-At": "2026-07-26T10:15:30.000Z",
          },
        }
      )
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
    const app = new TypeweaverApp().route(
      new MetricRouter({ requestHandlers: createMetricBoundaryHandlers() })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/not-a-number`, {
        headers: { "X-Attempt": "3" },
      })
    );

    await expectValidationIssue(response, "param");
  });
});

describe("Generated Server static and nested routes", () => {
  test("routes /todos/query to the static query operation", async () => {
    const app = createTestApp();
    const requestData = createQueryTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos/query`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });

  test("decodes path parameters before passing them to generated handlers", async () => {
    const app = createTestApp({
      validateRequests: false,
      validateResponses: false,
    });
    const requestData = createGetTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos/runtime%20todo%2B42`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe("runtime todo+42");
  });

  test("propagates nested subtodo route parameters", async () => {
    const app = createTestApp();
    const requestData = createUpdateSubTodoRequest({
      param: {
        todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P",
        subtodoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6Q",
      },
      body: { title: "Nested route update" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/${requestData.param.subtodoId}`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["id"]).toBe(requestData.param.subtodoId);
    expect(data["title"]).toBe("Nested route update");
  });

  test("routes nested list requests to the subtodo collection handler", async () => {
    const app = createTestApp();
    const requestData = createListSubTodosRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });
});

describe("Generated Server nested route methods", () => {
  test("returns the parent id and body fields from the create subtodo route", async () => {
    const app = createTestApp();
    const requestData = createCreateSubTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { title: "Create nested route" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos`,
        requestData
      )
    );

    const data = await expectJson(response, 201);
    expect(data["parentId"]).toBe(requestData.param.todoId);
    expect(data["title"]).toBe("Create nested route");
  });

  test("routes nested static query requests to the subtodo query handler", async () => {
    const app = createTestApp();
    const requestData = createQuerySubTodoRequest({
      param: { todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P" },
      body: { searchText: "nested search" },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/query`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });

  test("routes nested delete requests to the subtodo delete handler", async () => {
    const app = createTestApp();
    const requestData = createDeleteSubTodoRequest({
      param: {
        todoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6P",
        subtodoId: "01J9Z8ZK9Y3X2W1V0T9S8R7Q6Q",
      },
    });

    const response = await app.fetch(
      buildFetchRequest(
        `${BASE_URL}/todos/${requestData.param.todoId}/subtodos/${requestData.param.subtodoId}`,
        requestData
      )
    );

    const data = await expectJson(response, 200);
    expect(data["message"]).toEqual(expect.any(String));
  });
});
