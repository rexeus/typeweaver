import type { IValidatedHttpRequest } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createGetMetricKeyedLabelsSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricSuccessResponse,
  createGetTodoRequest,
  createListTodosRequest,
  createTestApp,
  createUpdateTodoRequest,
  MetricRouter,
  TypeweaverApp,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  BASE_URL,
  buildFetchRequest,
  expectErrorResponse,
  expectJson,
  postRaw,
} from "../../../helpers.js";
import { expectValidationIssue } from "./fixtures.js";
import type { ServerMetricApiHandler } from "test-utils";

function buildRawBodyFetchRequest(
  url: string,
  requestData: IValidatedHttpRequest,
  body: string
): Request {
  return buildFetchRequest(url, { ...requestData, body });
}

function aCreateTodoJsonBodyWithPrototypePollutionPayload(
  validBody: object
): string {
  const payload = Object.assign(Object.create(null), validBody, {
    constructor: { prototype: { polluted: "yes" } },
    prototype: { polluted: "yes" },
  }) as Record<string, unknown>;

  Object.defineProperty(payload, "__proto__", {
    value: { polluted: "yes" },
    enumerable: true,
  });

  return JSON.stringify(payload);
}

describe("Generated Server dynamic validation mode", () => {
  const createDynamicHandlers = (
    onMetricId: (metricId: unknown) => void
  ): ServerMetricApiHandler<Record<string, unknown>, boolean> => ({
    handleGetMetricRequest: async request => {
      onMetricId(request.param.metricId);
      return createGetMetricSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: { metricId: 42, enabled: true },
      });
    },
    handleGetMetricLabelsRequest: async () =>
      createGetMetricLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: { metricId: 42, labels: {}, flags: {} },
      }),
    handleGetMetricSamplesRequest: async () =>
      createGetMetricSamplesSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: { metricId: 42, samples: {} },
      }),
    handleGetMetricKeyedLabelsRequest: async () =>
      createGetMetricKeyedLabelsSuccessResponse({
        header: { "Content-Type": "application/json" },
        body: { metricId: 42, labels: {} },
      }),
  });

  test("delivers validated values when dynamic validation is enabled", async () => {
    const observed: unknown[] = [];
    const app = new TypeweaverApp().route(
      new MetricRouter<Record<string, unknown>, boolean>({
        validateRequests: true,
        requestHandlers: createDynamicHandlers(value => observed.push(value)),
      })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42`, { headers: { "X-Attempt": "3" } })
    );

    expect(response.status).toBe(200);
    expect(observed).toEqual([42]);
  });

  test("delivers raw values when dynamic validation is disabled", async () => {
    const observed: unknown[] = [];
    const app = new TypeweaverApp().route(
      new MetricRouter<Record<string, unknown>, boolean>({
        validateRequests: false,
        requestHandlers: createDynamicHandlers(value => observed.push(value)),
      })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42`, { headers: { "X-Attempt": "3" } })
    );

    expect(response.status).toBe(200);
    expect(observed).toEqual(["42"]);
  });
  test("delivers validated values in literal true mode", async () => {
    const observed: unknown[] = [];
    const app = new TypeweaverApp().route(
      new MetricRouter<Record<string, unknown>, true>({
        validateRequests: true,
        requestHandlers: createDynamicHandlers(value => observed.push(value)),
      })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42`, { headers: { "X-Attempt": "3" } })
    );

    expect(response.status).toBe(200);
    expect(observed).toEqual([42]);
  });

  test("delivers raw values in literal false mode", async () => {
    const observed: unknown[] = [];
    const app = new TypeweaverApp().route(
      new MetricRouter<Record<string, unknown>, false>({
        validateRequests: false,
        requestHandlers: createDynamicHandlers(value => observed.push(value)),
      })
    );

    const response = await app.fetch(
      new Request(`${BASE_URL}/metrics/42`, { headers: { "X-Attempt": "3" } })
    );

    expect(response.status).toBe(200);
    expect(observed).toEqual(["42"]);
  });
});

describe("Generated Server request validation bypass", () => {
  test.each([
    {
      name: "body",
      createRequest: () =>
        createCreateTodoRequest({
          body: { priority: "INVALID_PRIORITY" as never },
        }),
      url: `${BASE_URL}/todos`,
      issueKey: "body" as const,
    },
    {
      name: "headers",
      createRequest: () =>
        createCreateTodoRequest({
          header: { "Content-Type": "text/plain" as never },
        }),
      url: `${BASE_URL}/todos`,
      issueKey: "header" as const,
    },
    {
      name: "path parameters",
      createRequest: () => createUpdateTodoRequest(),
      url: `${BASE_URL}/todos/invalid-uuid-format`,
      issueKey: "param" as const,
    },
    {
      name: "query parameters",
      createRequest: () => createListTodosRequest(),
      url: `${BASE_URL}/todos?status=INVALID_STATUS`,
      issueKey: "query" as const,
    },
  ])("rejects invalid $name", async ({ createRequest, url, issueKey }) => {
    const app = createTestApp();
    const requestData = createRequest();

    const response = await app.fetch(buildFetchRequest(url, requestData));

    await expectValidationIssue(response, issueKey);
  });

  test("bypasses body validation when validateRequests is disabled", async () => {
    const app = createTestApp({ validateRequests: false });
    const requestData = createCreateTodoRequest({ body: { title: "" } });

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    expect(response.status).toBe(201);
  });

  test("bypasses path validation when validateRequests is disabled", async () => {
    const app = createTestApp({
      validateRequests: false,
      validateResponses: false,
    });
    const requestData = createGetTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos/not-a-ulid`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe("not-a-ulid");
  });

  test("bypasses query validation when validateRequests is disabled", async () => {
    const app = createTestApp({ validateRequests: false });
    const requestData = createListTodosRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos?status=INVALID_STATUS`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["results"]).toEqual(expect.any(Array));
  });

  test("preserves encoded dangerous path parameters at the fetch boundary", async () => {
    const app = createTestApp({
      validateRequests: false,
      validateResponses: false,
    });
    const requestData = createGetTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos/a%2Fb`, requestData)
    );

    const data = await expectJson(response, 200);
    expect(data["id"]).toBe("a%2Fb");
  });
});

describe("Generated Server request validation errors", () => {
  test("uses a custom request validation error handler when provided", async () => {
    const app = createTestApp({
      handleRequestValidationErrors: () => ({
        statusCode: 400,
        header: { "Content-Type": "application/json" },
        body: { message: "Custom validation error" },
      }),
    });
    const requestData = createCreateTodoRequest({
      body: { priority: "INVALID_PRIORITY" as never },
    });

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 400);
    expect(data["message"]).toBe("Custom validation error");
  });

  test("returns a sanitized bad request response for malformed JSON", async () => {
    const app = createTestApp();

    const response = await app.fetch(
      postRaw("/todos", '{"title":', "application/json")
    );

    const data = await expectErrorResponse(response, 400, "BAD_REQUEST");
    expect(data["message"]).toBe("Malformed request body");
    expect(JSON.stringify(data)).not.toContain("title");
  });

  test("returns payload too large when the generated app body limit is exceeded", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const app = createTestApp({ maxBodySize: 16 });

    try {
      const response = await app.fetch(
        postRaw("/todos", "x".repeat(32), "text/plain")
      );

      await expectErrorResponse(response, 413, "PAYLOAD_TOO_LARGE");
    } finally {
      consoleError.mockRestore();
    }
  });

  test("does not pollute Object.prototype from generated JSON request bodies", async () => {
    const app = createTestApp();
    const requestData = createCreateTodoRequest({
      body: { title: "Pollution guard" },
    });
    const rawBody = aCreateTodoJsonBodyWithPrototypePollutionPayload(
      requestData.body
    );

    try {
      const response = await app.fetch(
        buildRawBodyFetchRequest(`${BASE_URL}/todos`, requestData, rawBody)
      );

      const data = await expectJson(response, 201);
      expect(data["title"]).toBe("Pollution guard");
      expect(Object.prototype).not.toHaveProperty("polluted");
    } finally {
      delete (Object.prototype as { polluted?: unknown }).polluted;
    }
  });
});
