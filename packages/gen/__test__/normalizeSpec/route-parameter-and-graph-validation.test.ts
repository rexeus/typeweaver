import { defineDerivedResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  DuplicateRouteError,
  InvalidRequestSchemaError,
  MissingDerivedResponseParentError,
  PathParameterMismatchError,
} from "../../src/index.js";
import {
  aCanonicalResponse,
  aMalformedSpec,
  anOperation,
  aSpec,
  normalizeSpec,
  theOnlyOperationIn,
  withRawRequest,
} from "./fixtures.js";

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
          withRawRequest(anOperation({ path: "/todos/:todoId" }), {
            param: z.string(),
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
          operations: [withRawRequest(anOperation(), request)],
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
