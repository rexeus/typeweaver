import assert from "node:assert";
import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import {
  GetMetricKeyedLabelsRequestValidator,
  GetMetricLabelsRequestValidator,
  GetMetricSamplesRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { issuePaths, parseRawStringRecord } from "./fixtures.js";
import type { IGetMetricLabelsRequest } from "test-utils";

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
    const query = parseRawStringRecord('{"__proto__":"1"}');

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
    const query = parseRawStringRecord('{"constructor":"1","toString":"2"}');
    const header = parseRawStringRecord(
      '{"constructor":"true","toString":"false"}'
    );

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

describe("Generated RequestValidator record key identity", () => {
  const rawKeyedRequest = (parts: {
    query?: IRawHttpRequest["query"];
    header?: IRawHttpRequest["header"];
  }): IRawHttpRequest => ({
    method: HttpMethod.GET,
    path: "/metrics/42/keyed-labels",
    param: { metricId: "42" },
    ...parts,
  });

  test("rejects a trimmed query key", () => {
    const query = parseRawStringRecord('{" p50 ":"1"}');

    const result = new GetMetricKeyedLabelsRequestValidator().safeValidate(
      rawKeyedRequest({ query })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.queryIssues)).toEqual([[" p50 "]]);
  });

  test("rejects a lowercased header key and a transformed __proto__ output", () => {
    const header = parseRawStringRecord('{"ABC":"true","__PROTO__":"false"}');

    const result = new GetMetricKeyedLabelsRequestValidator().safeValidate(
      rawKeyedRequest({ header })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.headerIssues)).toEqual([
      ["ABC"],
      ["__PROTO__"],
    ]);
  });

  test("rejects a key that would collide with a preserved key", () => {
    const header = parseRawStringRecord('{"ABC":"true","abc":"false"}');

    const result = new GetMetricKeyedLabelsRequestValidator().safeValidate(
      rawKeyedRequest({ header })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.headerIssues)).toEqual([["ABC"]]);
  });

  test("accepts preserved keys, including constructor", () => {
    const query = parseRawStringRecord('{"p50":"1","constructor":"2"}');
    const header = parseRawStringRecord(
      '{"tostring":"true","constructor":"false"}'
    );

    const result = new GetMetricKeyedLabelsRequestValidator().safeValidate(
      rawKeyedRequest({ query, header })
    );

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query).toEqual({ p50: 1, constructor: 2 });
    expect(result.data.header).toEqual({
      tostring: true,
      constructor: false,
    });
  });
});
