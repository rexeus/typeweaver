import { HttpMethod } from "@rexeus/typeweaver-core";
import { expectTypeOf } from "vitest";
import type {
  IGetMetricLabelsRequestHeader,
  IRawGetMetricRequest,
  IRawGetMetricSamplesRequest,
} from "test-utils";

// Raw aliases do not promise schema casing, declared-only keys, or a literal
// method: HEAD may fall back to the GET route.
export const lowercaseHeaders: IRawGetMetricRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42",
  param: { metricId: "42" },
  header: { "x-attempt": "3", "x-undeclared": "value" },
  query: { undeclared: "value" },
};

export const headFallbackRawRequest: IRawGetMetricRequest = {
  method: HttpMethod.HEAD,
  path: "/metrics/42",
  param: { metricId: "42" },
};

expectTypeOf<IRawGetMetricRequest["method"]>().toEqualTypeOf<HttpMethod>();

// `Readonly<Record<string, boolean> | undefined>` preserves `undefined` in
// TypeScript; it does not collapse to `{}`. Guards the generated record header
// alias against a reported false positive.
export const undefinedRecordHeader: IGetMetricLabelsRequestHeader = undefined;
export const definedRecordHeader: IGetMetricLabelsRequestHeader = {
  "feature-a": true,
};

// Repeated transport values for a scalar query schema are accepted before
// validation; the generated validator decides whether multiplicity is allowed.
export const repeatedScalarQuery: IRawGetMetricRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42",
  param: { metricId: "42" },
  query: { truthy: ["false", "true"] },
};

// Array header schemas commonly arrive as a single comma-delimited string.
export const commaDelimitedArrayHeader: IRawGetMetricRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42",
  param: { metricId: "42" },
  header: { "X-Flags": "false, true", "X-Attempt": "3" },
};

// Required query/header values can be absent before validation.
export const missingRequiredValues: IRawGetMetricRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42",
  param: { metricId: "42" },
};

// Record array containers accept singleton and repeated raw transport values.
export const recordArrayRawRequest: IRawGetMetricSamplesRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42/samples",
  param: { metricId: "42" },
  query: { p50: "1.5", p99: ["2", "3"] },
  header: { "x-series": "alpha, beta" },
};
