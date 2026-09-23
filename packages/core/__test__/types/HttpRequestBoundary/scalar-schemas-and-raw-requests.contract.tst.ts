import { expectTypeOf } from "vitest";
import { z } from "zod";
import { defineOperation, HttpMethod } from "../../../src/index.js";
import { successResponse } from "./fixtures.js";
import type {
  HttpRequestBoundaryIssues,
  IHttpRequest,
  IRawHttpRequestFor,
  RequestDefinition,
} from "../../../src/index.js";

expectTypeOf<
  HttpRequestBoundaryIssues<RequestDefinition>
>().toEqualTypeOf<never>();

const validBoundaryOperation = defineOperation({
  operationId: "readMetric",
  path: "/metrics/:metricId",
  method: HttpMethod.GET,
  summary: "Read a typed metric",
  request: {
    param: z.object({
      metricId: z.coerce.number().int(),
    }),
    query: z.object({
      enabled: z.stringbool(),
      capturedAt: z.string().transform(value => new Date(value)),
      samples: z.array(z.coerce.number()),
    }),
    header: z.object({
      "x-attempt": z.coerce.number().int(),
      "x-flags": z.array(z.stringbool()).optional(),
    }),
  },
  responses: [successResponse],
});

const validRecordBoundaryOperation = defineOperation({
  operationId: "readMetricLabels",
  path: "/metrics/:metricId/labels",
  method: HttpMethod.GET,
  summary: "Read typed metric label records",
  request: {
    param: z.object({
      metricId: z.coerce.bigint(),
    }),
    query: z.record(z.string(), z.coerce.number()).optional(),
    header: z.record(z.string(), z.stringbool()).optional(),
  },
  responses: [successResponse],
});

export type PreservedOperationId =
  typeof validBoundaryOperation.operationId extends "readMetric" ? true : never;
export type NumericPathOutput = z.output<
  typeof validBoundaryOperation.request.param
>["metricId"];
export type BooleanQueryOutput = z.output<
  typeof validBoundaryOperation.request.query
>["enabled"];
export type DateQueryOutput = z.output<
  typeof validBoundaryOperation.request.query
>["capturedAt"];
export type RecordQueryOutput = z.output<
  NonNullable<typeof validRecordBoundaryOperation.request.query>
>;
export type RecordHeaderOutput = z.output<
  NonNullable<typeof validRecordBoundaryOperation.request.header>
>;

expectTypeOf<RecordQueryOutput>().toEqualTypeOf<
  Record<string, number> | undefined
>();
expectTypeOf<RecordHeaderOutput>().toEqualTypeOf<
  Record<string, boolean> | undefined
>();

const invalidNumericPathOperation = {
  operationId: "invalidNumericPath",
  path: "/metrics/:metricId",
  method: HttpMethod.GET,
  summary: "Reject an impossible raw path schema",
  request: {
    param: z.object({ metricId: z.number() }),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error z.number() does not accept a raw HTTP string
defineOperation(invalidNumericPathOperation);

const invalidBooleanQueryOperation = {
  operationId: "invalidBooleanQuery",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject an impossible raw query schema",
  request: {
    query: z.object({ enabled: z.boolean() }),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error z.boolean() does not accept a raw HTTP string
defineOperation(invalidBooleanQueryOperation);

const invalidObjectQueryOutputOperation = {
  operationId: "invalidObjectQueryOutput",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject an impossible query output",
  request: {
    query: z.object({
      filter: z.string().transform(value => ({ value })),
    }),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error objects cannot be serialized as HTTP query scalars
defineOperation(invalidObjectQueryOutputOperation);

const invalidArrayPathOutputOperation = {
  operationId: "invalidArrayPathOutput",
  path: "/metrics/:metricId",
  method: HttpMethod.GET,
  summary: "Reject an array-valued path field",
  request: {
    param: z.object({
      metricId: z.array(z.coerce.number()),
    }),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error path fields must produce one HTTP scalar
defineOperation(invalidArrayPathOutputOperation);

const invalidUnknownRecordValueOperation = {
  operationId: "invalidUnknownRecordValue",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject a concrete unknown record value",
  request: {
    query: z.record(z.string(), z.unknown()),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error concrete unknown record values are not client HTTP scalars
defineOperation(invalidUnknownRecordValueOperation);

const invalidAnyRecordValueOperation = {
  operationId: "invalidAnyRecordValue",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject a concrete any record value",
  request: {
    header: z.record(z.string(), z.any()),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error concrete any record values are not client HTTP scalars
defineOperation(invalidAnyRecordValueOperation);

const invalidObjectRecordValueOperation = {
  operationId: "invalidObjectRecordValue",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject an object record value",
  request: {
    query: z.record(z.string(), z.object({ value: z.string() })),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error object record values are not client HTTP scalars
defineOperation(invalidObjectRecordValueOperation);

const invalidNestedArrayRecordValueOperation = {
  operationId: "invalidNestedArrayRecordValue",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject nested array record values",
  request: {
    query: z.record(z.string(), z.array(z.array(z.string()))),
  },
  responses: [successResponse],
} as const;

// @ts-expect-error nested array record values are not client HTTP scalars
defineOperation(invalidNestedArrayRecordValueOperation);

const validArrayRecordValueOperation = defineOperation({
  operationId: "readMetricArrayRecordValues",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Accept array record values",
  request: {
    query: z.record(z.string(), z.array(z.coerce.number())).optional(),
  },
  responses: [successResponse],
});

export type ArrayRecordQueryOutput = z.output<
  NonNullable<typeof validArrayRecordValueOperation.request.query>
>;

/**
 * A record value typed only as the base `z.ZodType` keeps compiling, matching
 * the unresolved schema carried by the base `RequestDefinition`.
 */
export const defineUnresolvedRecordOperation = (value: z.ZodType) =>
  defineOperation({
    operationId: "readUnresolvedRecord",
    path: "/metrics",
    method: HttpMethod.GET,
    summary: "Accept an unresolved record value schema",
    request: {
      query: z.record(z.string(), value),
    },
    responses: [successResponse],
  });

type ExampleValidatedHeader = Readonly<{
  "X-Attempt": number;
  "X-Flags"?: boolean[];
}>;
type ExampleValidatedParam = Readonly<{ metricId: number }>;
type ExampleValidatedQuery = Readonly<{
  truthy?: boolean;
  samples?: number[];
}>;
type ExampleValidatedBody = Readonly<{ title: string }>;

type ExampleValidatedRequest = IHttpRequest<
  ExampleValidatedHeader,
  ExampleValidatedParam,
  ExampleValidatedQuery,
  ExampleValidatedBody
> & {
  readonly path: string;
  readonly method: HttpMethod.POST;
  readonly header: ExampleValidatedHeader;
  readonly param: ExampleValidatedParam;
  readonly query: ExampleValidatedQuery;
  readonly body: ExampleValidatedBody;
};

type ExampleRawRequest = IRawHttpRequestFor<ExampleValidatedRequest>;

// Adapter guarantees, not validated output: query/header stay open transport
// records with lowercase/runtime keys and undeclared values possible, params are
// the router-guaranteed raw strings, `method` stays `HttpMethod` for HEAD
// fallback, and the body stays optional `unknown`.
export const adapterShapedRawRequest: ExampleRawRequest = {
  method: HttpMethod.POST,
  path: "/metrics/42",
  query: { truthy: ["false", "true"], samples: "1.5" },
  header: { "X-Flags": "false, true" },
  param: { metricId: "42" },
  body: { title: "raw" },
};

// Query/header/body may be absent pre-validation while route params remain.
export const rawRequestWithoutOptionalParts: ExampleRawRequest = {
  method: HttpMethod.POST,
  path: "/metrics/42",
  param: { metricId: "42" },
};

// Lowercase mixed-case schema headers, undeclared wire keys, and a HEAD method
// (which may fall back to the GET route) are all representable.
export const undeclaredTransportRequest: ExampleRawRequest = {
  method: HttpMethod.HEAD,
  path: "/metrics/42",
  param: { metricId: "42" },
  query: { undeclared: "value", samples: ["1"] },
  header: { "x-flags": "false, true", "x-undeclared": ["a", "b"] },
};

expectTypeOf<ExampleRawRequest["method"]>().toEqualTypeOf<HttpMethod>();
expectTypeOf<NonNullable<ExampleRawRequest["query"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[] | undefined>>
>();
expectTypeOf<NonNullable<ExampleRawRequest["header"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[] | undefined>>
>();
expectTypeOf<ExampleRawRequest["param"]>().toEqualTypeOf<
  Readonly<{ metricId: string }>
>();
expectTypeOf<ExampleRawRequest["body"]>().toEqualTypeOf<unknown>();

type RecordValidatedRequest = IHttpRequest<
  Readonly<Record<string, boolean> | undefined>,
  Readonly<Record<string, number>>,
  Readonly<Record<string, number> | undefined>,
  undefined
> & {
  readonly path: string;
  readonly method: HttpMethod.GET;
  readonly header: Readonly<Record<string, boolean> | undefined>;
  readonly param: Readonly<Record<string, number>>;
  readonly query: Readonly<Record<string, number> | undefined>;
};

type RecordRawRequest = IRawHttpRequestFor<RecordValidatedRequest>;

expectTypeOf<NonNullable<RecordRawRequest["header"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[] | undefined>>
>();
expectTypeOf<NonNullable<RecordRawRequest["query"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[] | undefined>>
>();
expectTypeOf<NonNullable<RecordRawRequest["param"]>>().toEqualTypeOf<
  Readonly<Record<string, string>>
>();

export const recordRawHeader: NonNullable<RecordRawRequest["header"]> = {
  p50: "1",
  p99: ["2", "3"],
};
export const recordRawWithoutContainers: RecordRawRequest = {
  method: HttpMethod.GET,
  path: "/metrics/42",
  param: {},
};

type ParamlessValidatedRequest = IHttpRequest<
  undefined,
  undefined,
  Readonly<{ status?: string }>,
  undefined
> & {
  readonly path: string;
  readonly method: HttpMethod.GET;
  readonly query: Readonly<{ status?: string }>;
};

type ParamlessRawRequest = IRawHttpRequestFor<ParamlessValidatedRequest>;

export const paramlessRawRequest: ParamlessRawRequest = {
  method: HttpMethod.GET,
  path: "/todos",
};
expectTypeOf<ParamlessRawRequest["param"]>().toEqualTypeOf<undefined>();
expectTypeOf<ParamlessRawRequest["method"]>().toEqualTypeOf<HttpMethod>();
expectTypeOf<NonNullable<ParamlessRawRequest["query"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[] | undefined>>
>();
