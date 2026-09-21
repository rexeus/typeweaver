import { z } from "zod";
import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "../../src/index.js";
import type { RequestDefinition } from "../../src/index.js";

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

// Record key schemas must preserve key identity. Detectable pipes/transforms
// and non-string key schemas are rejected; plain string, string refinements,
// string formats, literals, and enums are supported.
const operationWithQueryRecordKey = <TKey extends z.core.$ZodRecordKey>(
  key: TKey
) => operationWithQuery(z.record(key, z.string()));

export const plainStringKeyRecord = defineOperation(
  operationWithQueryRecordKey(z.string())
);
export const refinedStringKeyRecord = defineOperation(
  operationWithQueryRecordKey(z.string().min(1))
);
export const formatStringKeyRecord = defineOperation(
  operationWithQueryRecordKey(z.uuid())
);
export const literalKeyRecord = defineOperation(
  operationWithQueryRecordKey(z.literal("metric"))
);
export const enumKeyRecord = defineOperation(
  operationWithQueryRecordKey(z.enum(["p50", "p99"]))
);

const invalidTransformKeyRecord = operationWithQueryRecordKey(
  z.string().transform(() => "__proto__")
);
// @ts-expect-error transforming record keys can emit reserved/colliding keys
defineOperation(invalidTransformKeyRecord);

const invalidPipeKeyRecord = operationWithQueryRecordKey(
  z.string().pipe(z.string())
);
// @ts-expect-error pipe record keys may transform key identity
defineOperation(invalidPipeKeyRecord);

const invalidPreprocessKeyRecord = operationWithQueryRecordKey(
  z.preprocess(input => input, z.string())
);
// @ts-expect-error preprocess record keys are opaque
defineOperation(invalidPreprocessKeyRecord);

const invalidNumberKeyRecord = operationWithQueryRecordKey(z.number());
// @ts-expect-error numeric record keys are not string keys
defineOperation(invalidNumberKeyRecord);

const invalidSymbolKeyRecord = operationWithQueryRecordKey(z.symbol());
// @ts-expect-error symbol record keys are not string keys
defineOperation(invalidSymbolKeyRecord);

// Statically known `__proto__` keys are rejected in request object shapes and
// in finite record key literal/enum schemas.
const invalidReservedQueryShape = operationWithQuery(
  z.object({ ["__proto__"]: z.string() })
);
// @ts-expect-error query object shapes must not declare '__proto__'
defineOperation(invalidReservedQueryShape);

const invalidReservedParamShape = {
  operationId: "invalidReservedParamShape",
  path: "/metrics/:metricId",
  method: HttpMethod.GET,
  summary: "Reject a reserved param shape key",
  request: {
    param: z.object({ ["__proto__"]: z.string(), metricId: z.string() }),
  },
  responses: [successResponse],
} as const;
// @ts-expect-error param object shapes must not declare '__proto__'
defineOperation(invalidReservedParamShape);

const invalidReservedLiteralKey = operationWithQueryRecordKey(
  z.literal("__proto__")
);
// @ts-expect-error a literal '__proto__' record key is reserved
defineOperation(invalidReservedLiteralKey);

const invalidReservedEnumKey = operationWithQueryRecordKey(
  z.enum(["p50", "__proto__"])
);
// @ts-expect-error an enum record key containing '__proto__' is reserved
defineOperation(invalidReservedEnumKey);

// Reserved route placeholders are rejected at the definition boundary.
const invalidReservedPathOperation = {
  operationId: "invalidReservedPath",
  path: "/metrics/:__proto__",
  method: HttpMethod.GET,
  summary: "Reject a reserved path parameter",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is a reserved path parameter
defineOperation(invalidReservedPathOperation);

// The record key issue is always evaluated, including when the record value is
// the intentional broad base schema; only the value field check is skipped.
const operationWithQueryRecordKeyValue = <
  TKey extends z.core.$ZodRecordKey,
  TValue extends z.ZodType,
>(
  key: TKey,
  value: TValue
) => operationWithQuery(z.record(key, value));

const broadRecordValue: z.ZodType = z.string();

export const broadValueStringKeyRecord = defineOperation(
  operationWithQueryRecordKeyValue(z.string(), broadRecordValue)
);

const invalidBroadValueReservedLiteralKey = operationWithQueryRecordKeyValue(
  z.literal("__proto__"),
  broadRecordValue
);
// @ts-expect-error a reserved literal key must reject even with a broad value
defineOperation(invalidBroadValueReservedLiteralKey);

const invalidBroadValueReservedEnumKey = operationWithQueryRecordKeyValue(
  z.enum(["__proto__", "p50"]),
  broadRecordValue
);
// @ts-expect-error a reserved enum key must reject even with a broad value
defineOperation(invalidBroadValueReservedEnumKey);

const invalidBroadValueTransformKey = operationWithQueryRecordKeyValue(
  z.string().transform(() => "__proto__"),
  broadRecordValue
);
// @ts-expect-error a transforming key must reject even with a broad value
defineOperation(invalidBroadValueTransformKey);

// Canonical placeholder grammar: `:__proto__` is rejected when embedded or
// suffixed, while ordinary embedded placeholders are preserved.
const invalidEmbeddedReservedPath = {
  operationId: "invalidEmbeddedReservedPath",
  path: "/files/:__proto__.:format",
  method: HttpMethod.GET,
  summary: "Reject an embedded reserved path parameter",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is reserved even when embedded
defineOperation(invalidEmbeddedReservedPath);

const invalidSuffixedReservedPath = {
  operationId: "invalidSuffixedReservedPath",
  path: "/:__proto__-suffix",
  method: HttpMethod.GET,
  summary: "Reject a suffixed reserved path parameter",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is reserved even when suffixed
defineOperation(invalidSuffixedReservedPath);

export const embeddedFormatPathOperation = defineOperation({
  operationId: "embeddedFormatPath",
  path: "/files/:fileId.:format",
  method: HttpMethod.GET,
  summary: "Preserve an ordinary embedded placeholder",
  request: { param: z.object({ fileId: z.string(), format: z.string() }) },
  responses: [successResponse],
});

// Exact canonical placeholder-name parsing: `:__proto__` is rejected for any
// non-name terminator and at any occurrence, while non-reserved prefixes are
// preserved.
const invalidBraceReservedPath = {
  operationId: "invalidBraceReservedPath",
  path: "/files/:__proto__{suffix}",
  method: HttpMethod.GET,
  summary: "Reject a brace-terminated reserved placeholder",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is reserved with a '{' terminator
defineOperation(invalidBraceReservedPath);

const invalidPunctuationReservedPath = {
  operationId: "invalidPunctuationReservedPath",
  path: "/:__proto__!suffix",
  method: HttpMethod.GET,
  summary: "Reject a punctuation-terminated reserved placeholder",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is reserved with a punctuation terminator
defineOperation(invalidPunctuationReservedPath);

const invalidLaterReservedPath = {
  operationId: "invalidLaterReservedPath",
  path: "/a/:x/:__proto__",
  method: HttpMethod.GET,
  summary: "Reject a later reserved placeholder",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is reserved at a later occurrence
defineOperation(invalidLaterReservedPath);

const invalidColonReservedPath = {
  operationId: "invalidColonReservedPath",
  path: "/:__proto__:rest",
  method: HttpMethod.GET,
  summary: "Reject a colon-terminated reserved placeholder",
  request: {},
  responses: [successResponse],
} as const;
// @ts-expect-error ':__proto__' is reserved before a ':' terminator
defineOperation(invalidColonReservedPath);

export const prefixedPlaceholderOperation = defineOperation({
  operationId: "prefixedPlaceholder",
  path: "/todos/:__proto__x/:x__proto__",
  method: HttpMethod.GET,
  summary: "Preserve non-reserved placeholder prefixes",
  request: {},
  responses: [successResponse],
});
