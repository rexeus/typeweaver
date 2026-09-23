import {
  defineDerivedResponse,
  defineResponse,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { Cause, Effect } from "effect";
import { describe, expect, test } from "vitest";
import {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  InvalidDerivedResponseError,
  MissingDerivedResponseParentError,
  normalizeSpec as normalizeSpecEffect,
} from "../../src/index.js";
import { TestAssertionError } from "../errors/index.js";
import {
  aCanonicalResponse,
  anInlineResponse,
  anOperation,
  aSpec,
  normalizeSpec,
  withDerivedMetadata,
} from "./fixtures.js";

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
