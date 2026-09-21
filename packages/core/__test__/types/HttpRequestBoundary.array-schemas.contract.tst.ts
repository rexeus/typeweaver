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
