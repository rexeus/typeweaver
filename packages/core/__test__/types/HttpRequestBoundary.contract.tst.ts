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
  IHttpRequest,
  IRawHttpRequestFor,
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
  Readonly<Record<string, string | readonly string[]>>
>();
expectTypeOf<NonNullable<ExampleRawRequest["header"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[]>>
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
  Readonly<Record<string, string | readonly string[]>>
>();
expectTypeOf<NonNullable<RecordRawRequest["query"]>>().toEqualTypeOf<
  Readonly<Record<string, string | readonly string[]>>
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
  Readonly<Record<string, string | readonly string[]>>
>();

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

// Transparent array wrappers are accepted because runtime cardinality detection
// unwraps the same public classes.
export const defaultedArrayQuery = defineOperation(
  operationWithQuery(
    z.object({ samples: z.array(z.coerce.number()).default([]) })
  )
);
export const readonlyArrayQuery = defineOperation(
  operationWithQuery(
    z.object({ samples: z.readonly(z.array(z.coerce.number())) })
  )
);
export const caughtArrayQuery = defineOperation(
  operationWithQuery(
    z.object({ samples: z.array(z.coerce.number()).catch([]) })
  )
);
export const pipedArrayQuery = defineOperation(
  operationWithQuery(
    z.object({ samples: z.array(z.coerce.number()).pipe(z.array(z.number())) })
  )
);
export const nestedOptionalArrayQuery = defineOperation(
  operationWithQuery(
    z.object({
      samples: z.optional(z.array(z.coerce.number())).nonoptional(),
    })
  )
);
export const defaultedArrayRecord = defineOperation(
  operationWithQueryRecordValue(z.array(z.coerce.number()).default([]))
);
export const readonlyArrayRecord = defineOperation(
  operationWithQueryRecordValue(z.readonly(z.array(z.coerce.number())))
);
export const pipedArrayRecord = defineOperation(
  operationWithQueryRecordValue(
    z.array(z.coerce.number()).pipe(z.array(z.number()))
  )
);
export const nestedOptionalArrayRecord = defineOperation(
  operationWithQueryRecordValue(
    z.optional(z.array(z.coerce.number())).nonoptional()
  )
);

export const optionalWrappedPipeQuery = defineOperation(
  operationWithQuery(
    z.object({
      samples: z.optional(z.array(z.coerce.number()).pipe(z.array(z.number()))),
    })
  )
);
export const defaultedPipeRecord = defineOperation(
  operationWithQueryRecordValue(
    z.array(z.coerce.number()).pipe(z.array(z.number())).default([])
  )
);
export const optionalWrappedPipeRecord = defineOperation(
  operationWithQueryRecordValue(
    z.optional(z.array(z.coerce.number()).pipe(z.array(z.number())))
  )
);

// Array element kind is inspected, so `any`/`unknown`/nested/object/nullish
// elements are rejected for object fields.
const invalidAnyElementQuery = {
  operationId: "invalidAnyElement",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject any array elements",
  request: { query: z.object({ samples: z.array(z.any()) }) },
  responses: [successResponse],
} as const;
// @ts-expect-error array elements must be client HTTP scalars
defineOperation(invalidAnyElementQuery);

const invalidUnknownElementQuery = {
  operationId: "invalidUnknownElement",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject unknown array elements",
  request: { query: z.object({ samples: z.array(z.unknown()) }) },
  responses: [successResponse],
} as const;
// @ts-expect-error array elements must be client HTTP scalars
defineOperation(invalidUnknownElementQuery);

const invalidNestedArrayElementQuery = {
  operationId: "invalidNestedArrayElement",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject nested array elements",
  request: { query: z.object({ samples: z.array(z.array(z.string())) }) },
  responses: [successResponse],
} as const;
// @ts-expect-error nested arrays are not client HTTP scalars
defineOperation(invalidNestedArrayElementQuery);

const invalidObjectElementQuery = {
  operationId: "invalidObjectElement",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject object array elements",
  request: {
    query: z.object({ samples: z.array(z.object({ value: z.string() })) }),
  },
  responses: [successResponse],
} as const;
// @ts-expect-error object array elements are not client HTTP scalars
defineOperation(invalidObjectElementQuery);

const invalidNullishElementQuery = {
  operationId: "invalidNullishElement",
  path: "/metrics",
  method: HttpMethod.GET,
  summary: "Reject nullish array elements",
  request: { query: z.object({ samples: z.array(z.string().nullable()) }) },
  responses: [successResponse],
} as const;
// @ts-expect-error nullish array elements are not client HTTP scalars
defineOperation(invalidNullishElementQuery);

// Opaque transforms and unions whose array output cannot be identified are
// rejected rather than accepted with a lying contract.
const invalidArrayToScalarTransform = operationWithQuery(
  z.object({
    samples: z.array(z.coerce.number()).transform(value => value.join(",")),
  })
);
// @ts-expect-error an array transport input transformed to a scalar is opaque
defineOperation(invalidArrayToScalarTransform);

const invalidScalarToArrayTransform = operationWithQuery(
  z.object({ samples: z.coerce.number().transform(value => [value]) })
);
// @ts-expect-error a scalar transport input transformed to an array is opaque
defineOperation(invalidScalarToArrayTransform);

const invalidArrayScalarUnion = operationWithQuery(
  z.object({
    samples: z.union([z.array(z.coerce.number()), z.string()]),
  })
);
// @ts-expect-error an array/scalar union has no reliable cardinality
defineOperation(invalidArrayScalarUnion);

// Concrete any/unknown through wrappers and unions cannot exploit the
// unresolved-schema escape.
const invalidAnyArrayRecord = operationWithQueryRecordValue(z.array(z.any()));
// @ts-expect-error array of any record values
defineOperation(invalidAnyArrayRecord);

const invalidUnknownUnionRecord = operationWithQueryRecordValue(
  z.union([z.string(), z.unknown()])
);
// @ts-expect-error union containing unknown record values
defineOperation(invalidUnknownUnionRecord);

const invalidOptionalUnknownRecord = operationWithQueryRecordValue(
  z.optional(z.unknown())
);
// @ts-expect-error optional unknown record values
defineOperation(invalidOptionalUnknownRecord);

const invalidDefaultedUnknownRecord = operationWithQueryRecordValue(
  z.unknown().default("x")
);
// @ts-expect-error defaulted unknown record values
defineOperation(invalidDefaultedUnknownRecord);

const invalidPipedUnknownRecord = operationWithQueryRecordValue(
  z.unknown().pipe(z.unknown())
);
// @ts-expect-error a pipe with an unknown output is not a client scalar
defineOperation(invalidPipedUnknownRecord);

// A pipe whose output is a client scalar flows through normal classification.
export const scalarOutputPipeRecord = defineOperation(
  operationWithQueryRecordValue(z.unknown().pipe(z.string()))
);

// Object fields also reject concrete any/unknown through unions and wrappers.
const invalidAnyUnionObjectField = operationWithQuery(
  z.object({ samples: z.union([z.string(), z.any()]) })
);
// @ts-expect-error union containing any object field
defineOperation(invalidAnyUnionObjectField);

const invalidOptionalUnknownObjectField = operationWithQuery(
  z.object({ samples: z.optional(z.unknown()) })
);
// @ts-expect-error optional unknown object field
defineOperation(invalidOptionalUnknownObjectField);

// Nullable, lazy, xor, intersection, and never forms flow through output
// classification and are rejected when they cannot be a client scalar.
const invalidNullableRecord = operationWithQueryRecordValue(
  z.string().nullable()
);
// @ts-expect-error nullable record values are not client scalars
defineOperation(invalidNullableRecord);

const invalidNeverRecord = operationWithQueryRecordValue(z.never());
// @ts-expect-error never record values are not client scalars
defineOperation(invalidNeverRecord);

const invalidNeverArrayRecord = operationWithQueryRecordValue(
  z.array(z.never())
);
// @ts-expect-error arrays of never are not client scalar arrays
defineOperation(invalidNeverArrayRecord);

const invalidLazyArrayRecord = operationWithQueryRecordValue(
  z.lazy(() => z.array(z.coerce.number()))
);
// @ts-expect-error a lazy array has no identifiable transport cardinality
defineOperation(invalidLazyArrayRecord);

const invalidLazyUnknownRecord = operationWithQueryRecordValue(
  z.lazy(() => z.unknown())
);
// @ts-expect-error a lazy unknown record value is not a client scalar
defineOperation(invalidLazyUnknownRecord);

const invalidXorArrayRecord = operationWithQueryRecordValue(
  z.xor([z.array(z.coerce.number()), z.string()])
);
// @ts-expect-error an xor array/scalar output is not a client scalar
defineOperation(invalidXorArrayRecord);

const invalidIntersectionRecord = operationWithQueryRecordValue(
  z.intersection(
    z.object({ left: z.string() }),
    z.object({ right: z.string() })
  )
);
// @ts-expect-error intersection record values are not client scalars
defineOperation(invalidIntersectionRecord);

const invalidNeverObjectField = operationWithQuery(
  z.object({ samples: z.never() })
);
// @ts-expect-error never object fields are not client scalars
defineOperation(invalidNeverObjectField);

const invalidNeverArrayObjectField = operationWithQuery(
  z.object({ samples: z.array(z.never()) })
);
// @ts-expect-error arrays of never are not client scalar arrays
defineOperation(invalidNeverArrayObjectField);

const invalidNullableObjectField = operationWithQuery(
  z.object({ samples: z.string().nullable() })
);
// @ts-expect-error nullable object fields are not client scalars
defineOperation(invalidNullableObjectField);

const invalidLazyArrayObjectField = operationWithQuery(
  z.object({ samples: z.lazy(() => z.array(z.coerce.number())) })
);
// @ts-expect-error a lazy array object field has no identifiable cardinality
defineOperation(invalidLazyArrayObjectField);

// Open/catchall/loose request object containers are rejected; authors must use
// z.record when undeclared keys are expected. Default strip/strict objects stay
// supported.
const invalidCatchallAny = operationWithQuery(
  z.object({ metric: z.string() }).catchall(z.any())
);
// @ts-expect-error catchall(any) is an open object container
defineOperation(invalidCatchallAny);

const invalidCatchallObject = operationWithQuery(
  z.object({ metric: z.string() }).catchall(z.object({ value: z.string() }))
);
// @ts-expect-error catchall(object) is an open object container
defineOperation(invalidCatchallObject);

const invalidCatchallScalar = operationWithQuery(
  z.object({ metric: z.string() }).catchall(z.string())
);
// @ts-expect-error catchall(scalar) is an open object container
defineOperation(invalidCatchallScalar);

const invalidCatchallNestedArray = operationWithQuery(
  z.object({ metric: z.string() }).catchall(z.array(z.array(z.string())))
);
// @ts-expect-error catchall(nested array) is an open object container
defineOperation(invalidCatchallNestedArray);

const invalidLooseObject = operationWithQuery(
  z.looseObject({ metric: z.string() })
);
// @ts-expect-error loose objects are open object containers
defineOperation(invalidLooseObject);

export const stripObjectQuery = defineOperation(
  operationWithQuery(z.object({ metric: z.string() }))
);
export const strictObjectQuery = defineOperation(
  operationWithQuery(z.strictObject({ metric: z.string() }))
);
export const closedCatchallNeverQuery = defineOperation(
  operationWithQuery(z.object({ metric: z.string() }).catchall(z.never()))
);

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
