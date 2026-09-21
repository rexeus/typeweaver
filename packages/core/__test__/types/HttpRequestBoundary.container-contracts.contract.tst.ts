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

const operationWithQueryRecordValue = <TValue extends z.ZodType>(
  value: TValue
) => operationWithQuery(z.record(z.string(), value));

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
