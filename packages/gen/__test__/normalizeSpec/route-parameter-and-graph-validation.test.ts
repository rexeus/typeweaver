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
import { Effect, Result } from "effect";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  DuplicateRouteError,
  InvalidRequestSchemaError,
  MissingDerivedResponseParentError,
  normalizeSpec as normalizeSpecEffect,
  PathParameterMismatchError,
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

const aMalformedSpec = (
  resources: SpecDefinition["resources"]
): SpecDefinition => {
  return { metadata: testMetadata, resources };
};

const theOnlyOperationIn = (
  normalizedSpec: ReturnType<typeof normalizeSpec>
) => {
  const operation = normalizedSpec.resources[0]?.operations[0];

  if (operation === undefined) {
    throw new TestAssertionError(
      "Expected the normalized spec to contain one operation."
    );
  }

  return operation;
};

describe("normalizeSpec route edge validation", () => {
  test("distinguishes literal colons from embedded placeholders", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      files: {
        operations: [
          anOperation({
            operationId: "getColonReport",
            path: "/files/report:",
            responses: [okResponse],
          }),
          anOperation({
            operationId: "getReportById",
            path: "/files/report:id",
            request: { param: z.object({ id: z.string() }) },
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(normalizeSpec(spec).resources[0]?.operations).toHaveLength(2);
  });

  test("rejects trailing slash route conflicts", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "listTodos",
            path: "/todos",
            responses: [okResponse],
          }),
          anOperation({
            operationId: "listTodosWithSlash",
            path: "/todos/",
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
  });

  test("rejects route conflicts across resources", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ operationId: "getTodo", responses: [okResponse] }),
        ],
      },
      accounts: {
        operations: [
          anOperation({
            operationId: "getAccountTodo",
            path: "/todos",
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
  });
});

describe("normalizeSpec request and path parameter validation", () => {
  test("rejects path parameters without request.param", () => {
    const spec = aSpec({
      todos: {
        operations: [anOperation({ path: "/todos/:todoId", request: {} })],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(PathParameterMismatchError);
  });

  test("rejects request.param keys without path placeholders", () => {
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            path: "/todos",
            request: { param: z.object({ todoId: z.string() }) },
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(PathParameterMismatchError);
  });

  test("rejects request.param keys that do not match path placeholder names", () => {
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            path: "/todos/:todoId",
            request: { param: z.object({ id: z.string() }) },
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(PathParameterMismatchError);
  });

  test("accepts matching path parameters in a different object key order", () => {
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            path: "/orgs/:orgId/todos/:todoId",
            request: {
              param: z.object({ todoId: z.string(), orgId: z.string() }),
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(theOnlyOperationIn(normalizedSpec).request?.param?.shape).toEqual(
      expect.objectContaining({
        orgId: expect.any(Object) as unknown,
        todoId: expect.any(Object) as unknown,
      }) as unknown
    );
  });

  test("rejects request.param schemas that are not Zod objects", () => {
    const spec = aMalformedSpec({
      todos: {
        operations: [
          anOperation({
            path: "/todos/:todoId",
            request: { param: z.string() } as unknown as RequestDefinition,
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidRequestSchemaError);
  });

  test.each([
    { scenario: "header", request: { header: { parse: () => ({}) } } },
    { scenario: "query", request: { query: { parse: () => ({}) } } },
    { scenario: "body", request: { body: { parse: () => ({}) } } },
  ])(
    "rejects request.$scenario values that are not Zod schemas",
    ({ request }) => {
      const spec = aMalformedSpec({
        todos: {
          operations: [
            anOperation({ request: request as unknown as RequestDefinition }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(InvalidRequestSchemaError);
    }
  );
});

describe("normalizeSpec canonical and derived response graph validation", () => {
  test("rejects derived responses whose parent canonical response is absent", () => {
    const parentResponse = aCanonicalResponse("ParentResponse");
    const childResponse = defineDerivedResponse(parentResponse, {
      name: "ChildResponse",
    });
    const spec = aSpec({
      todos: { operations: [anOperation({ responses: [childResponse] })] },
    });

    expect(() => normalizeSpec(spec)).toThrowError(
      MissingDerivedResponseParentError
    );
  });

  test("accepts derived responses whose parent canonical response appears later", () => {
    const parentResponse = aCanonicalResponse("ParentResponse");
    const childResponse = defineDerivedResponse(parentResponse, {
      name: "ChildResponse",
    });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "getChild",
            responses: [childResponse],
          }),
          anOperation({
            operationId: "getParent",
            path: "/parents",
            responses: [parentResponse],
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses.map(response => response.name)).toEqual([
      "ChildResponse",
      "ParentResponse",
    ]);
  });

  test("normalizes multi-level derived response chains with immediate parent and full lineage", () => {
    const rootResponse = aCanonicalResponse("RootResponse");
    const childResponse = defineDerivedResponse(rootResponse, {
      name: "ChildResponse",
    });
    const grandchildResponse = defineDerivedResponse(childResponse, {
      name: "GrandchildResponse",
    });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            responses: [rootResponse, childResponse, grandchildResponse],
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    expect(
      normalizedSpec.responses.find(
        response => response.name === "GrandchildResponse"
      )
    ).toMatchObject({
      name: "GrandchildResponse",
      kind: "derived-response",
      derivedFrom: "ChildResponse",
      lineage: ["ChildResponse", "GrandchildResponse"],
      depth: 2,
    });
  });
});
