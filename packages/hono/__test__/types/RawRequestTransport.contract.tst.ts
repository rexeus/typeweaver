import { HttpMethod } from "@rexeus/typeweaver-core";
import { expectTypeOf } from "vitest";
import type {
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
expectTypeOf<NonNullable<IRawGetMetricRequest["header"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[]>>
>();
expectTypeOf<NonNullable<IRawGetMetricRequest["query"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[]>>
>();

export const recordArrayRawRequest: IRawGetMetricSamplesRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42/samples",
  param: { metricId: "42" },
  query: { p50: "1.5", p99: ["2", "3"] },
  header: { "x-series": "alpha, beta" },
};
