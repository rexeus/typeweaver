import { expectTypeOf } from "vitest";
import { z } from "zod";
import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "../../src/index.js";
import type {
  HttpRequestBoundaryIssues,
  RequestDefinition,
} from "../../src/index.js";

expectTypeOf<
  HttpRequestBoundaryIssues<RequestDefinition>
>().toEqualTypeOf<never>();

const successResponse = defineResponse({
  name: "HttpBoundarySuccess",
  statusCode: HttpStatusCode.OK,
  description: "A typed HTTP-boundary request was accepted.",
  header: z.object({}),
  body: z.object({ ok: z.literal(true) }),
});

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
