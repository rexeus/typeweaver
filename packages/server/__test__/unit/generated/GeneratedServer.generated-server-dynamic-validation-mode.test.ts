import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  createGetMetricSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricKeyedLabelsSuccessResponse,
  MetricRouter,
  TypeweaverApp,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { BASE_URL, expectErrorResponse } from "../../helpers.js";
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
