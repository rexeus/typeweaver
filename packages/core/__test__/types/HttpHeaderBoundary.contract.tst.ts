import { z } from "zod";
import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "../../src/index.js";
import type {
  HttpHeaderSchema,
  HttpRequestHeaderSchema,
} from "../../src/index.js";

export const literalResponseHeaderSchema: HttpHeaderSchema = z.object({
  "X-Kind": z.literal("json"),
});
export const arrayResponseHeaderSchema: HttpHeaderSchema = z.object({
  "X-Tags": z.array(z.string()),
});
export const recordResponseHeaderSchema: HttpHeaderSchema = z.record(
  z.string(),
  z.string()
);

const transportSafeResponse = defineResponse({
  name: "TransportSafeResponse",
  statusCode: HttpStatusCode.OK,
  description: "A transport-safe string response header.",
  header: z.object({ "X-Request-Id": z.string() }),
  body: z.object({ ok: z.literal(true) }),
});

// Positive regression contracts proving existing literal, optional, array,
// string-format, object, and record response schemas keep compiling under the
// restored transport-safe `HttpHeaderSchema`.
export const literalHeaderResponse = defineResponse({
  name: "LiteralHeaderResponse",
  statusCode: HttpStatusCode.OK,
  description: "A literal response header.",
  header: z.object({ "X-Kind": z.literal("json") }),
  body: z.object({ ok: z.literal(true) }),
});

export const optionalStringHeaderResponse = defineResponse({
  name: "OptionalStringHeaderResponse",
  statusCode: HttpStatusCode.OK,
  description: "An optional string response header.",
  header: z.object({ "X-Trace": z.string().optional() }),
  body: z.object({ ok: z.literal(true) }),
});

export const arrayStringHeaderResponse = defineResponse({
  name: "ArrayStringHeaderResponse",
  statusCode: HttpStatusCode.OK,
  description: "A string-array response header.",
  header: z.object({ "X-Tags": z.array(z.string()) }),
  body: z.object({ ok: z.literal(true) }),
});

export const uuidHeaderResponse = defineResponse({
  name: "UuidHeaderResponse",
  statusCode: HttpStatusCode.OK,
  description: "A string-format response header.",
  header: z.object({ "X-Request-Id": z.uuid() }),
  body: z.object({ ok: z.literal(true) }),
});

export const recordHeaderResponse = defineResponse({
  name: "RecordHeaderResponse",
  statusCode: HttpStatusCode.OK,
  description: "A record response header container.",
  header: z.record(z.string(), z.string()),
  body: z.object({ ok: z.literal(true) }),
});

export const optionalRecordHeaderResponse = defineResponse({
  name: "OptionalRecordHeaderResponse",
  statusCode: HttpStatusCode.OK,
  description: "An optional record response header container.",
  header: z.record(z.string(), z.string().optional()),
  body: z.object({ ok: z.literal(true) }),
});

// The restored stack-base response contract stays transport-safe: values must
// produce `string` or `string[]`.
const invalidCoercingResponseHeader = {
  name: "InvalidCoercingResponseHeader",
  statusCode: HttpStatusCode.OK,
  description: "A coercing response header is not transport-safe.",
  header: z.object({ "X-Attempt": z.coerce.number() }),
  body: z.object({ ok: z.literal(true) }),
} as const;

// @ts-expect-error response headers must produce transport-safe string values
defineResponse(invalidCoercingResponseHeader);

const invalidArrayResponseHeader = {
  name: "InvalidArrayResponseHeader",
  statusCode: HttpStatusCode.OK,
  description: "A non-string response header value is not transport-safe.",
  header: z.object({ "X-Values": z.array(z.coerce.number()) }),
  body: z.object({ ok: z.literal(true) }),
} as const;

// @ts-expect-error response header arrays must contain strings
defineResponse(invalidArrayResponseHeader);

const invalidNumericResponseHeader = {
  name: "InvalidNumericResponseHeader",
  statusCode: HttpStatusCode.OK,
  description: "A numeric response header is not transport-safe.",
  header: z.object({ "X-Count": z.number() }),
  body: z.object({ ok: z.literal(true) }),
} as const;

// @ts-expect-error numeric response headers are not transport-safe
defineResponse(invalidNumericResponseHeader);

const invalidNumericRecordResponseHeader = {
  name: "InvalidNumericRecordResponseHeader",
  statusCode: HttpStatusCode.OK,
  description: "A numeric record response header is not transport-safe.",
  header: z.record(z.string(), z.number()),
  body: z.object({ ok: z.literal(true) }),
} as const;

// @ts-expect-error numeric record response headers are not transport-safe
defineResponse(invalidNumericRecordResponseHeader);

// Request headers keep the broad coercing/domain-output contract.
export const coercingRequestHeaderOperation = defineOperation({
  operationId: "coercingRequestHeader",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Accept a coercing request header",
  request: {
    header: z.object({
      "X-Attempt": z.coerce.number(),
      "X-Flags": z.array(z.stringbool()).optional(),
    }),
  },
  responses: [transportSafeResponse],
});

export const requestHeaderRecord: HttpRequestHeaderSchema = z.record(
  z.string(),
  z.coerce.number()
);
