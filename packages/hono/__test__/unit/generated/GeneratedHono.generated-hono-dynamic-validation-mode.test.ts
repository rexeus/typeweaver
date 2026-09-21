import {
  defineOperation,
  HttpMethod,
  ReservedPathParameterError,
} from "@rexeus/typeweaver-core";
import {
  createGetMetricSuccessResponse,
  createGetMetricLabelsSuccessResponse,
  createGetMetricSamplesSuccessResponse,
  createGetMetricKeyedLabelsSuccessResponse,
  MetricHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { expectErrorResponse } from "../../helpers.js";
import type {
  HonoMetricApiHandler,
  IGetMetricRequest,
  IValidationErrorResponseBody,
} from "test-utils";

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

describe("Generated Hono dynamic validation mode", () => {
  const createDynamicHandlers = (
    onMetricId: (metricId: unknown) => void
  ): HonoMetricApiHandler<boolean> => ({
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
    const app = new MetricHono<boolean>({
      validateRequests: true,
      requestHandlers: createDynamicHandlers(value => observed.push(value)),
    });

    const response = await app.request("http://localhost/metrics/42", {
      headers: { "X-Attempt": "3" },
    });

    expect(response.status).toBe(200);
    expect(observed).toEqual([42]);
  });

  test("delivers raw values when dynamic validation is disabled", async () => {
    const observed: unknown[] = [];
    const app = new MetricHono<boolean>({
      validateRequests: false,
      requestHandlers: createDynamicHandlers(value => observed.push(value)),
    });

    const response = await app.request("http://localhost/metrics/42", {
      headers: { "X-Attempt": "3" },
    });

    expect(response.status).toBe(200);
    expect(observed).toEqual(["42"]);
  });
  test("delivers validated values in literal true mode", async () => {
    const observed: unknown[] = [];
    const app = new MetricHono<true>({
      validateRequests: true,
      requestHandlers: createDynamicHandlers(value => observed.push(value)),
    });

    const response = await app.request("http://localhost/metrics/42", {
      headers: { "X-Attempt": "3" },
    });

    expect(response.status).toBe(200);
    expect(observed).toEqual([42]);
  });

  test("delivers raw values in literal false mode", async () => {
    const observed: unknown[] = [];
    const app = new MetricHono<false>({
      validateRequests: false,
      requestHandlers: createDynamicHandlers(value => observed.push(value)),
    });

    const response = await app.request("http://localhost/metrics/42", {
      headers: { "X-Attempt": "3" },
    });

    expect(response.status).toBe(200);
    expect(observed).toEqual(["42"]);
  });
});

describe("Generated Hono raw transport truthfulness", () => {
  test("matches lowercase schema headers and ignores undeclared wire values", async () => {
    let captured: IGetMetricRequest | undefined;
    const app = new MetricHono({
      requestHandlers: createMetricBoundaryHandlers(request => {
        captured = request;
      }),
    });

    const response = await app.request(
      "http://localhost/metrics/42?undeclared=1",
      { headers: { "x-attempt": "3", "x-undeclared": "value" } }
    );

    expect(response.status).toBe(200);
    expect(captured?.header["X-Attempt"]).toBe(3);
    expect(captured?.header).not.toHaveProperty("x-attempt");
    expect(captured?.query).not.toHaveProperty("undeclared");
  });

  test("falls back from HEAD to the GET route", async () => {
    let captured: IGetMetricRequest | undefined;
    const app = new MetricHono({
      requestHandlers: createMetricBoundaryHandlers(request => {
        captured = request;
      }),
    });

    const response = await app.request("http://localhost/metrics/42", {
      method: "HEAD",
      headers: { "X-Attempt": "3" },
    });

    expect(response.status).toBe(200);
    expect(captured?.method).toBe(HttpMethod.GET);
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
