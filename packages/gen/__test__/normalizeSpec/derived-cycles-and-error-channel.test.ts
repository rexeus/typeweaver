import {
  defineDerivedResponse,
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type {
  RequestDefinition,
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { Cause, Effect, Result } from "effect";
import { describe, expect, test } from "vitest";
import {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  InvalidDerivedResponseError,
  MissingDerivedResponseParentError,
  normalizeSpec as normalizeSpecEffect,
} from "../../src/index.js";
import { TestAssertionError } from "../errors/index.js";
import type { NormalizedSpec } from "../../src/index.js";

// Test shim that bridges the legacy sync call surface onto the new Effect
// API. `Effect.result` flattens typed failures into the success channel
// so the existing `toThrowError` / `instanceof` assertions keep working
// against the underlying error rather than Effect's `FiberFailure` wrapper.
const normalizeSpec = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.result(normalizeSpecEffect(spec)));
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

type ResponseBaseOverrides = {
  readonly statusCode?: HttpStatusCode;
  readonly description?: string;
  readonly header?: ResponseDefinition["header"];
  readonly body?: ResponseDefinition["body"];
};

type InlineResponseOverrides = ResponseBaseOverrides & {
  readonly derived?: NonNullable<ResponseDefinition["derived"]>;
};

type OperationOverrides = {
  readonly operationId?: string;
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly summary?: string;
  readonly request?: RequestDefinition;
  readonly responses?: readonly ResponseDefinition[];
};

const aResponseNameFor = (operationId: string): string => {
  const identifier = operationId.replace(/[^A-Za-z0-9]/gu, "");

  return `${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}Response`;
};

const aCanonicalResponse = (
  name = "OkResponse",
  overrides: ResponseBaseOverrides = {}
): ResponseDefinition => {
  return defineResponse({
    name,
    statusCode: overrides.statusCode ?? HttpStatusCode.OK,
    description: overrides.description ?? `${name} description`,
    header: overrides.header,
    body: overrides.body,
  });
};

const anInlineResponse = (
  name = "InlineResponse",
  overrides: InlineResponseOverrides = {}
): ResponseDefinition => {
  return {
    name,
    statusCode: overrides.statusCode ?? HttpStatusCode.BAD_REQUEST,
    description: overrides.description ?? `${name} description`,
    header: overrides.header,
    body: overrides.body,
    derived: overrides.derived,
  };
};

const anOperation = (overrides: OperationOverrides = {}) => {
  const operationId = overrides.operationId ?? "getTodo";

  return defineOperation({
    operationId,
    method: overrides.method ?? HttpMethod.GET,
    path: overrides.path ?? "/todos",
    summary: overrides.summary ?? `${operationId} summary`,
    request: overrides.request ?? {},
    responses: overrides.responses ?? [
      aCanonicalResponse(aResponseNameFor(operationId)),
    ],
  });
};

const testMetadata = {
  title: "Normalization Test API",
  version: "1.0.0",
} as const;

const aSpec = (resources: SpecDefinition["resources"]): SpecDefinition => {
  return defineSpec({ metadata: testMetadata, resources });
};

const withDerivedMetadata = <TResponse extends ResponseDefinition>(
  response: TResponse,
  metadata: NonNullable<ResponseDefinition["derived"]>
): TResponse => {
  Object.defineProperty(response, "derived", {
    value: metadata,
    enumerable: true,
    configurable: true,
    writable: true,
  });

  return response;
};

describe("normalizeSpec derived response cycles", () => {
  test("rejects derived response graph cycles between distinct canonical responses", () => {
    const firstResponse = withDerivedMetadata(
      aCanonicalResponse("FirstResponse"),
      {
        parentName: "SecondResponse",
        lineage: ["FirstResponse"],
        depth: 1,
      }
    );
    const secondResponse = withDerivedMetadata(
      aCanonicalResponse("SecondResponse"),
      {
        parentName: "FirstResponse",
        lineage: ["SecondResponse"],
        depth: 1,
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [firstResponse, secondResponse] }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
  });

  test("rejects derived response cycles from malformed metadata", () => {
    const cyclicResponse = withDerivedMetadata(
      aCanonicalResponse("CyclicResponse"),
      {
        parentName: "CyclicResponse",
        lineage: ["CyclicResponse"],
        depth: 1,
      }
    );
    const spec = aSpec({
      todos: { operations: [anOperation({ responses: [cyclicResponse] })] },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
  });

  test("rejects frozen authored responses with cyclic derived metadata", () => {
    const cyclicResponse = defineResponse(
      Object.freeze({
        name: "FrozenCyclicResponse",
        statusCode: HttpStatusCode.OK,
        description: "Frozen cyclic response",
        derived: {
          parentName: "FrozenCyclicResponse",
          lineage: ["FrozenCyclicResponse"],
          depth: 1,
        },
      })
    );
    const spec = aSpec({
      todos: { operations: [anOperation({ responses: [cyclicResponse] })] },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
  });

  test("rejects derived responses whose lineage metadata disagrees with the graph", () => {
    const parentResponse = aCanonicalResponse("ParentResponse");
    const childResponse = withDerivedMetadata(
      defineDerivedResponse(parentResponse, {
        name: "ChildResponse",
      }),
      {
        parentName: "ParentResponse",
        lineage: ["WrongResponse"],
        depth: 1,
      }
    );
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [parentResponse, childResponse] }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidDerivedResponseError);
  });
});

describe("normalizeSpec missing inline derived response parents", () => {
  test("rejects inline derived response metadata whose parent is absent", () => {
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            responses: [
              anInlineResponse("InlineDerivedResponse", {
                derived: {
                  parentName: "MissingParentResponse",
                  lineage: ["InlineDerivedResponse"],
                  depth: 1,
                },
              }),
            ],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(
      MissingDerivedResponseParentError
    );
  });
});

// The legacy tests above use a sync shim for parity with the pre-Effect
// API. The cases below demonstrate the Effect-native shape that new code
// and reviewers should reach for: tagged-error matching via Cause inspection,
// recoverable handling via `Effect.catchTag`, etc.
describe("normalizeSpec effect-native error channel", () => {
  test("typed failure carries the offending operation ID", async () => {
    const sharedResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "duplicate",
            path: "/a",
            responses: [sharedResponse],
          }),
        ],
      },
      accounts: {
        operations: [
          anOperation({
            operationId: "duplicate",
            path: "/b",
            responses: [sharedResponse],
          }),
        ],
      },
    });
    const exit = await Effect.runPromise(
      Effect.exit(normalizeSpecEffect(spec))
    );

    if (exit._tag !== "Failure") {
      throw new TestAssertionError("expected normalize to fail");
    }

    const failureOption = Cause.findErrorOption(exit.cause);
    if (failureOption._tag !== "Some") {
      throw new TestAssertionError("expected a Cause.Fail");
    }

    const failure = failureOption.value;
    expect(failure._tag).toBe("DuplicateOperationIdError");
    if (!(failure instanceof DuplicateOperationIdError)) {
      throw new TestAssertionError(
        "expected DuplicateOperationIdError instance"
      );
    }
    expect(failure.operationId).toBe("duplicate");
  });
  test("Effect.catchTag recovers from a specific normalization error", async () => {
    const spec = aSpec({});

    const recovered = await Effect.runPromise(
      normalizeSpecEffect(spec).pipe(
        Effect.catchTag("EmptySpecResourcesError", () =>
          Effect.succeed("empty-fallback" as const)
        )
      )
    );

    expect(recovered).toBe("empty-fallback");
  });
});
