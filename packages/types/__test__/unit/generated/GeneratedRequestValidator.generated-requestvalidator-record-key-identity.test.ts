import assert from "node:assert";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import { GetMetricKeyedLabelsRequestValidator } from "test-utils";
import { describe, expect, test } from "vitest";

const issuePaths = (issues: RequestValidationError["bodyIssues"]) =>
  issues.map(issue => issue.path);

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
    const query = JSON.parse('{" p50 ":"1"}') as IRawHttpRequest["query"];

    const result = new GetMetricKeyedLabelsRequestValidator().safeValidate(
      rawKeyedRequest({ query })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.queryIssues)).toEqual([[" p50 "]]);
  });

  test("rejects a lowercased header key and a transformed __proto__ output", () => {
    const header = JSON.parse(
      '{"ABC":"true","__PROTO__":"false"}'
    ) as IRawHttpRequest["header"];

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
    const header = JSON.parse(
      '{"ABC":"true","abc":"false"}'
    ) as IRawHttpRequest["header"];

    const result = new GetMetricKeyedLabelsRequestValidator().safeValidate(
      rawKeyedRequest({ header })
    );

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.headerIssues)).toEqual([["ABC"]]);
  });

  test("accepts preserved keys, including constructor", () => {
    const query = JSON.parse(
      '{"p50":"1","constructor":"2"}'
    ) as IRawHttpRequest["query"];
    const header = JSON.parse(
      '{"tostring":"true","constructor":"false"}'
    ) as IRawHttpRequest["header"];

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
