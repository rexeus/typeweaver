import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createPutTodoRequest,
  createQueryTodoRequest,
  createTestApp,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
  MetricRouter,
  TypeweaverApp,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { BASE_URL, buildFetchRequest, expectJson } from "../../../helpers.js";
import {
  createMetricBoundaryHandlers,
  expectValidationIssue,
} from "./fixtures.js";
import type { IGetMetricRequest } from "test-utils";

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

describe("Generated Server raw transport truthfulness", () => {
  test("matches lowercase schema headers and ignores undeclared wire values", async () => {
    let captured: IGetMetricRequest | undefined;
    const app = new TypeweaverApp().route(
      new MetricRouter({
        requestHandlers: createMetricBoundaryHandlers(request => {
          captured = request;
        }),
      })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42?undeclared=1`, {
        headers: { "x-attempt": "3", "x-undeclared": "value" },
      })
    );

    expect(response.status).toBe(200);
    expect(captured?.header["X-Attempt"]).toBe(3);
    expect(captured?.header).not.toHaveProperty("x-attempt");
    expect(captured?.query).not.toHaveProperty("undeclared");
  });

  test("falls back from HEAD to the GET route", async () => {
    let captured: IGetMetricRequest | undefined;
    const app = new TypeweaverApp().route(
      new MetricRouter({
        requestHandlers: createMetricBoundaryHandlers(request => {
          captured = request;
        }),
      })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42`, {
        method: "HEAD",
        headers: { "X-Attempt": "3" },
      })
    );

    expect(response.status).toBe(200);
    expect(captured?.method).toBe(HttpMethod.GET);
  });
});

describe("Generated Server reserved record keys", () => {
  test("rejects an own __proto__ record query key", async () => {
    const app = new TypeweaverApp().route(
      new MetricRouter({ requestHandlers: createMetricBoundaryHandlers() })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42/labels?__proto__=1`)
    );

    await expectValidationIssue(response, "query");
  });
});
