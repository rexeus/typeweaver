import assert from "node:assert";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import {
  GetMetricRequestValidator,
  GetMetricLabelsRequestValidator,
  GetMetricSamplesRequestValidator,
  QuerySubTodoRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  IGetMetricRequest,
  IGetMetricLabelsRequest,
  IQuerySubTodoRequest,
} from "test-utils";

const TODO_ID = "01K0W0Y49HZVW1QTN6RZJJY203";

const AUTHORIZATION = "Bearer reference-token";

const validQuerySubTodoRequest = (): IQuerySubTodoRequest => ({
  method: HttpMethod.POST,
  path: `/todos/${TODO_ID}/subtodos/query`,
  header: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
  },
  query: {
    limit: "10",
    sortBy: "createdAt",
    sortOrder: "asc",
    format: "summary",
  },
  body: {
    searchText: "reference",
    status: "TODO",
    priority: "LOW",
    dateRange: {
      from: "2026-05-01",
      to: "2026-05-31",
    },
    tags: ["testing"],
  },
});

const requestWithRuntimePart = (
  request: IRawHttpRequest,
  part: "body" | "header" | "param" | "query",
  value: unknown
): IRawHttpRequest => ({
  ...request,
  [part]: value,
});

const issuePaths = (issues: RequestValidationError["bodyIssues"]) =>
  issues.map(issue => issue.path);

const querySubTodoRequestWithInvalidBodyHeaderParamAndQuery =
  (): IRawHttpRequest =>
    requestWithRuntimePart(
      requestWithRuntimePart(
        requestWithRuntimePart(
          requestWithRuntimePart(validQuerySubTodoRequest(), "body", {
            status: "BLOCKED",
          }),
          "header",
          { Accept: "text/plain" }
        ),
        "param",
        { todoId: "not-a-ulid" }
      ),
      "query",
      { sortBy: "updatedAt" }
    );

describe("Generated RequestValidator accumulated errors", () => {
  test("accumulates body, header, path parameter, and query issues", () => {
    const validator = new QuerySubTodoRequestValidator();
    const request = querySubTodoRequestWithInvalidBodyHeaderParamAndQuery();

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toEqual([["status"]]);
    expect(issuePaths(result.error.headerIssues)).toContainEqual(["Accept"]);
    expect(issuePaths(result.error.pathParamIssues)).toEqual([["todoId"]]);
    expect(issuePaths(result.error.queryIssues)).toEqual([["sortBy"]]);
  });

  test("does not expose partial validated data on failure", () => {
    const validator = new QuerySubTodoRequestValidator();
    const request = requestWithRuntimePart(
      validQuerySubTodoRequest(),
      "query",
      {
        format: "full",
      }
    );

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    expect("data" in result).toBe(false);
  });
});

describe("Generated RequestValidator typed HTTP boundary coercion", () => {
  const validRawMetricRequest = (): IRawHttpRequest => ({
    method: HttpMethod.GET,
    path: "/metrics/42",
    param: { metricId: "42" },
    query: {
      enabled: "false",
      truthy: "false",
      capturedAt: "2026-07-26T10:15:30.000Z",
      samples: ["1.5", "2"],
    },
    header: {
      "x-attempt": "3",
      "x-enabled": "false",
      "x-flags": "false, true",
      "x-note": "first, second",
      "x-observed-at": "2026-07-26T10:15:30.000Z",
    },
  });

  test("returns exact Zod output while preserving Zod boolean semantics", () => {
    const result = new GetMetricRequestValidator().safeValidate(
      validRawMetricRequest()
    );

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual<IGetMetricRequest>({
      method: HttpMethod.GET,
      path: "/metrics/42",
      param: { metricId: 42 },
      query: {
        enabled: false,
        truthy: true,
        capturedAt: new Date("2026-07-26T10:15:30.000Z"),
        samples: [1.5, 2],
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Flags": [false, true],
        "X-Note": "first, second",
        "X-Observed-At": new Date("2026-07-26T10:15:30.000Z"),
      },
    });
  });

  test("normalizes a singleton query value for an array schema", () => {
    const request = requestWithRuntimePart(validRawMetricRequest(), "query", {
      samples: "7",
    });

    const result = new GetMetricRequestValidator().safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query.samples).toEqual([7]);
  });

  test("rejects repeated raw values for a scalar query schema", () => {
    const request = requestWithRuntimePart(validRawMetricRequest(), "query", {
      truthy: ["false", "true"],
    });

    const result = new GetMetricRequestValidator().safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.queryIssues)).toContainEqual(["truthy"]);
  });

  test("rejects an invalid numeric path before handler dispatch", () => {
    const request = requestWithRuntimePart(validRawMetricRequest(), "param", {
      metricId: "not-a-number",
    });

    const result = new GetMetricRequestValidator().safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.pathParamIssues)).toContainEqual([
      "metricId",
    ]);
  });
});

describe("Generated RequestValidator record HTTP boundaries", () => {
  test("parses record query and header containers without dropping keys", () => {
    const result = new GetMetricLabelsRequestValidator().safeValidate({
      method: HttpMethod.GET,
      path: "/metrics/42/labels",
      param: { metricId: "42" },
      query: { p50: "1.5", p99: "2" },
      header: { "feature-a": "false", "feature-b": "true" },
    });

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual<IGetMetricLabelsRequest>({
      method: HttpMethod.GET,
      path: "/metrics/42/labels",
      param: { metricId: 42 },
      query: { p50: 1.5, p99: 2 },
      header: { "feature-a": false, "feature-b": true },
    });
  });

  test("preserves missing optional record containers as undefined", () => {
    const result = new GetMetricLabelsRequestValidator().safeValidate({
      method: HttpMethod.GET,
      path: "/metrics/42/labels",
      param: { metricId: "42" },
    });

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query).toBeUndefined();
    expect(result.data.header).toBeUndefined();
  });
});

describe("Generated RequestValidator record array normalization", () => {
  test("normalizes singleton and repeated query record array values", () => {
    const result = new GetMetricSamplesRequestValidator().safeValidate({
      method: HttpMethod.GET,
      path: "/metrics/42/samples",
      param: { metricId: "42" },
      query: { p50: "1.5", p99: ["2", "3"] },
    });

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query).toEqual({ p50: [1.5], p99: [2, 3] });
  });

  test("splits comma-delimited header record array values", () => {
    const result = new GetMetricSamplesRequestValidator().safeValidate({
      method: HttpMethod.GET,
      path: "/metrics/42/samples",
      param: { metricId: "42" },
      header: { "x-series": "alpha, beta", "x-single": "tag" },
    });

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.header).toEqual({
      "x-series": ["alpha", "beta"],
      "x-single": ["tag"],
    });
  });

  test("accepts repeated raw query values for an array record", () => {
    const result = new GetMetricSamplesRequestValidator().safeValidate({
      method: HttpMethod.GET,
      path: "/metrics/42/samples",
      param: { metricId: "42" },
      query: { p99: ["2", "3"] },
    });

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query).toEqual({ p99: [2, 3] });
  });

  test("rejects repeated raw values for a scalar record", () => {
    const result = new GetMetricLabelsRequestValidator().safeValidate({
      method: HttpMethod.GET,
      path: "/metrics/42/labels",
      param: { metricId: "42" },
      query: { p50: ["1", "2"] },
    });

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.queryIssues)).toContainEqual(["p50"]);
  });
});

describe("Generated RequestValidator reserved record keys", () => {
  const rawLabelsRequest = (parts: {
    query?: IRawHttpRequest["query"];
    header?: IRawHttpRequest["header"];
  }): IRawHttpRequest => ({
    method: HttpMethod.GET,
    path: "/metrics/42/labels",
    param: { metricId: "42" },
    ...parts,
  });

  test("rejects a JSON.parse __proto__ record query key", () => {
    const query = JSON.parse('{"__proto__":"1"}') as IRawHttpRequest["query"];

    const result = new GetMetricLabelsRequestValidator().safeValidate(
      rawLabelsRequest({ query })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.queryIssues)).toEqual([["__proto__"]]);
  });

  test("rejects a defineProperty __proto__ record header key", () => {
    const header: Record<string, string> = {};
    Object.defineProperty(header, "__proto__", {
      value: "true",
      writable: true,
      enumerable: true,
      configurable: true,
    });

    const result = new GetMetricLabelsRequestValidator().safeValidate(
      rawLabelsRequest({ header })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.headerIssues)).toEqual([["__proto__"]]);
  });

  test("preserves constructor and toString record keys end to end", () => {
    const query = JSON.parse(
      '{"constructor":"1","toString":"2"}'
    ) as IRawHttpRequest["query"];
    const header = JSON.parse(
      '{"constructor":"true","toString":"false"}'
    ) as IRawHttpRequest["header"];

    const result = new GetMetricLabelsRequestValidator().safeValidate(
      rawLabelsRequest({ query, header })
    );

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query).toEqual({ constructor: 1, toString: 2 });
    expect(result.data.header).toEqual({
      constructor: true,
      toString: false,
    });
  });
});
