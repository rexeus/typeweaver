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

const successResponse = defineResponse({
  name: "HttpBoundarySuccess",
  statusCode: HttpStatusCode.OK,
  description: "A typed HTTP-boundary request was accepted.",
  header: z.object({}),
  body: z.object({ ok: z.literal(true) }),
});

const operationWithQuery = <TQuery extends RequestDefinition["query"]>(
  query: TQuery
) => ({
  operationId: "boundaryQuery",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Boundary query",
  request: { query },
  responses: [successResponse],
});

const operationWithQueryRecordValue = <TValue extends z.ZodType>(
  value: TValue
) => operationWithQuery(z.record(z.string(), value));

// A bare unknown/any pipe input delegates raw acceptance to the downstream
// schema; ordinary typed string transforms and array-input pipes keep their
// typed raw input.
export const unknownPipeStringQuery = defineOperation(
  operationWithQuery(z.object({ value: z.unknown().pipe(z.string()) }))
);
export const unknownPipeCoercedNumberQuery = defineOperation(
  operationWithQuery(z.object({ value: z.unknown().pipe(z.coerce.number()) }))
);
export const anyPipeStringQuery = defineOperation(
  operationWithQuery(z.object({ value: z.any().pipe(z.string()) }))
);
export const anyPipeCoercedNumberQuery = defineOperation(
  operationWithQuery(z.object({ value: z.any().pipe(z.coerce.number()) }))
);
export const stringTransformQuery = defineOperation(
  operationWithQuery(
    z.object({ value: z.string().transform(value => value.trim()) })
  )
);
export const unknownPipeStringRecord = defineOperation(
  operationWithQueryRecordValue(z.unknown().pipe(z.string()))
);

const invalidUnknownPipeNumberQuery = operationWithQuery(
  z.object({ value: z.unknown().pipe(z.number()) })
);
// @ts-expect-error unknown.pipe(z.number()) does not accept a raw string
defineOperation(invalidUnknownPipeNumberQuery);

const invalidUnknownPipeBooleanQuery = operationWithQuery(
  z.object({ value: z.unknown().pipe(z.boolean()) })
);
// @ts-expect-error unknown.pipe(z.boolean()) does not accept a raw string
defineOperation(invalidUnknownPipeBooleanQuery);

const invalidUnknownPipeBigIntQuery = operationWithQuery(
  z.object({ value: z.unknown().pipe(z.bigint()) })
);
// @ts-expect-error unknown.pipe(z.bigint()) does not accept a raw string
defineOperation(invalidUnknownPipeBigIntQuery);

const invalidUnknownPipeDateQuery = operationWithQuery(
  z.object({ value: z.unknown().pipe(z.date()) })
);
// @ts-expect-error unknown.pipe(z.date()) does not accept a raw string
defineOperation(invalidUnknownPipeDateQuery);

const invalidAnyPipeNumberQuery = operationWithQuery(
  z.object({ value: z.any().pipe(z.number()) })
);
// @ts-expect-error any.pipe(z.number()) does not accept a raw string
defineOperation(invalidAnyPipeNumberQuery);

// Every preprocess/transform pipe input is opaque, even when a particular
// callback would coerce safely.
const invalidIdentityPreprocessNumber = operationWithQuery(
  z.object({ value: z.preprocess(input => input, z.number()) })
);
// @ts-expect-error preprocess input is opaque
defineOperation(invalidIdentityPreprocessNumber);

const invalidPreprocessCoercedNumber = operationWithQuery(
  z.object({ value: z.preprocess(input => input, z.coerce.number()) })
);
// @ts-expect-error preprocess input is opaque even when the downstream coerces
defineOperation(invalidPreprocessCoercedNumber);

const invalidPreprocessString = operationWithQuery(
  z.object({ value: z.preprocess(input => String(input), z.string()) })
);
// @ts-expect-error preprocess input is opaque even when the downstream is a string
defineOperation(invalidPreprocessString);

const invalidNonIdentityPreprocessNumber = operationWithQuery(
  z.object({ value: z.preprocess(input => Number(input), z.number()) })
);
// @ts-expect-error nonidentity preprocess input is opaque
defineOperation(invalidNonIdentityPreprocessNumber);

const invalidUnknownPipeNumberRecord = operationWithQueryRecordValue(
  z.unknown().pipe(z.number())
);
// @ts-expect-error unknown.pipe(z.number()) record values do not accept a raw string
defineOperation(invalidUnknownPipeNumberRecord);

const invalidPreprocessRecord = operationWithQueryRecordValue(
  z.preprocess(input => input, z.coerce.number())
);
// @ts-expect-error preprocess record values are opaque
defineOperation(invalidPreprocessRecord);

// The broad base schema carried by RequestDefinition stays accepted.
expectTypeOf<
  HttpRequestBoundaryIssues<RequestDefinition>
>().toEqualTypeOf<never>();
