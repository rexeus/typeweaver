import {
  DuplicateResponseNameError,
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
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  DuplicateRouteError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidDerivedResponseError,
  InvalidOperationIdError,
  InvalidRequestSchemaError,
  InvalidResourceNameError,
  MissingDerivedResponseParentError,
  normalizeSpec,
  PathParameterMismatchError,
} from "../src/index.js";

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

const aSpec = (resources: SpecDefinition["resources"]): SpecDefinition => {
  return defineSpec({ resources });
};

const aMalformedSpec = (
  resources: SpecDefinition["resources"]
): SpecDefinition => {
  return { resources };
};

const theOnlyOperationIn = (
  normalizedSpec: ReturnType<typeof normalizeSpec>
) => {
  const operation = normalizedSpec.resources[0]?.operations[0];

  if (operation === undefined) {
    throw new Error("Expected the normalized spec to contain one operation.");
  }

  return operation;
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

describe("normalizeSpec", () => {
  describe("normalization contracts", () => {
    test("orders resources by object insertion order", () => {
      const spec = aSpec({
        todos: { operations: [anOperation({ operationId: "listTodos" })] },
        accounts: {
          operations: [
            anOperation({ operationId: "listAccounts", path: "/accounts" }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.resources.map(resource => resource.name)).toEqual([
        "todos",
        "accounts",
      ]);
    });

    test("orders operations by each resource operations array", () => {
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ operationId: "listTodos", path: "/todos" }),
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(
        normalizedSpec.resources[0]?.operations.map(
          operation => operation.operationId
        )
      ).toEqual(["listTodos", "createTodo"]);
    });

    test("preserves operation fields", () => {
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "Create a todo",
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);

      expect(operation).toMatchObject({
        operationId: "createTodo",
        method: HttpMethod.POST,
        path: "/todos",
        summary: "Create a todo",
      });
    });

    test("normalizes an empty request object to an absent request", () => {
      const spec = aSpec({
        todos: { operations: [anOperation({ request: {} })] },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);

      expect(operation.request).toBeUndefined();
    });

    test("preserves request schemas by identity", () => {
      const header = z.object({ authorization: z.string() });
      const param = z.object({ todoId: z.string() });
      const query = z.object({ includeDone: z.coerce.boolean().optional() });
      const body = z.object({ title: z.string() });
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              path: "/todos/:todoId",
              request: { header, param, query, body },
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);

      expect(operation.request?.header).toBe(header);
      expect(operation.request?.param).toBe(param);
      expect(operation.request?.query).toBe(query);
      expect(operation.request?.body).toBe(body);
    });

    test("lists each canonical response once at the top level", () => {
      const okResponse = aCanonicalResponse("OkResponse");
      const conflictResponse = aCanonicalResponse("ConflictResponse", {
        statusCode: HttpStatusCode.CONFLICT,
      });
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [okResponse, conflictResponse] }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses.map(response => response.name)).toEqual([
        "OkResponse",
        "ConflictResponse",
      ]);
    });

    test("dedupes the same canonical response object reused across operations", () => {
      const okResponse = aCanonicalResponse("SharedTodoResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ operationId: "listTodos", responses: [okResponse] }),
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              responses: [okResponse],
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses).toHaveLength(1);
      expect(
        normalizedSpec.resources[0]?.operations.flatMap(
          operation => operation.responses
        )
      ).toEqual([
        { responseName: "SharedTodoResponse", source: "canonical" },
        { responseName: "SharedTodoResponse", source: "canonical" },
      ]);
    });

    test("represents canonical operation usages without inline response details", () => {
      const okResponse = aCanonicalResponse("TodoResponse");
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [okResponse] })] },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);
      expect(operation.responses[0]).toEqual({
        responseName: "TodoResponse",
        source: "canonical",
      });
    });

    test("keeps inline responses operation-local with their public normalized shape", () => {
      const header = z.object({ "x-retry-after": z.string() });
      const body = z.object({ message: z.string() });
      const inlineResponse = anInlineResponse("ValidationErrorResponse", {
        statusCode: HttpStatusCode.BAD_REQUEST,
        description: "Validation failed",
        header,
        body,
      });
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [inlineResponse] })] },
      });

      const normalizedSpec = normalizeSpec(spec);
      expect(normalizedSpec.responses).toEqual([]);
      expect(normalizedSpec.resources[0]?.operations[0]?.responses[0]).toEqual({
        responseName: "ValidationErrorResponse",
        source: "inline",
        response: {
          name: "ValidationErrorResponse",
          statusCode: HttpStatusCode.BAD_REQUEST,
          statusCodeName: "BadRequest",
          description: "Validation failed",
          header,
          body,
          kind: "response",
          derivedFrom: undefined,
          lineage: undefined,
          depth: undefined,
        },
      });
    });
  });

  describe("empty definitions", () => {
    test("rejects specs without resources", () => {
      expect(() => normalizeSpec(aMalformedSpec({}))).toThrowError(
        EmptySpecResourcesError
      );
    });

    test("rejects resources without operations", () => {
      const spec = aSpec({ todos: { operations: [] } });

      expect(() => normalizeSpec(spec)).toThrowError(
        EmptyResourceOperationsError
      );
    });

    test("rejects operations without responses", () => {
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [] })] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        EmptyOperationResponsesError
      );
    });
  });

  describe("identity and name validation", () => {
    test("rejects duplicate operation IDs globally", () => {
      const okResponse = aCanonicalResponse("SharedResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ operationId: "getItem", responses: [okResponse] }),
          ],
        },
        accounts: {
          operations: [
            anOperation({
              operationId: "getItem",
              path: "/accounts",
              responses: [okResponse],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DuplicateOperationIdError);
    });

    test.each([
      { scenario: "snake_case", operationId: "get_todo" },
      { scenario: "kebab-case", operationId: "get-todo" },
      { scenario: "leading digit", operationId: "1getTodo" },
    ])("rejects $scenario operation IDs", ({ operationId }) => {
      const spec = aSpec({
        todos: { operations: [anOperation({ operationId })] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(InvalidOperationIdError);
    });

    test.each([
      { scenario: "snake_case", resourceName: "user_profile" },
      { scenario: "kebab-case", resourceName: "user-profile" },
      { scenario: "leading digit", resourceName: "1userProfile" },
    ])("rejects $scenario resource names", ({ resourceName }) => {
      const spec = aSpec({
        [resourceName]: { operations: [anOperation()] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(InvalidResourceNameError);
    });

    test("rejects duplicate canonical response names", () => {
      const spec = aMalformedSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "listTodos",
              responses: [aCanonicalResponse("DuplicateResponse")],
            }),
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              responses: [aCanonicalResponse("DuplicateResponse")],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        DuplicateResponseNameError
      );
    });

    test("rejects duplicate inline response names", () => {
      const spec = aMalformedSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "listTodos",
              responses: [anInlineResponse("DuplicateInlineResponse")],
            }),
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              responses: [anInlineResponse("DuplicateInlineResponse")],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        DuplicateResponseNameError
      );
    });

    test("rejects inline response names that collide with canonical responses", () => {
      const spec = aMalformedSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "listTodos",
              responses: [aCanonicalResponse("TodoResponse")],
            }),
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              responses: [anInlineResponse("TodoResponse")],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        DuplicateResponseNameError
      );
    });
  });

  describe("route validation", () => {
    test("rejects the same method and normalized path when path parameter names differ", () => {
      const okResponse = aCanonicalResponse("SharedResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "getTodo",
              path: "/todos/:todoId",
              request: { param: z.object({ todoId: z.string() }) },
              responses: [okResponse],
            }),
            anOperation({
              operationId: "getAccountTodo",
              path: "/todos/:accountId",
              request: { param: z.object({ accountId: z.string() }) },
              responses: [okResponse],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
    });

    test("accepts the same normalized path with different HTTP methods", () => {
      const okResponse = aCanonicalResponse("SharedResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ operationId: "listTodos", responses: [okResponse] }),
            anOperation({
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              responses: [okResponse],
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.resources[0]?.operations).toHaveLength(2);
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

  describe("request and path parameter validation", () => {
    test("rejects path parameters without request.param", () => {
      const spec = aSpec({
        todos: {
          operations: [anOperation({ path: "/todos/:todoId", request: {} })],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        PathParameterMismatchError
      );
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

      expect(() => normalizeSpec(spec)).toThrowError(
        PathParameterMismatchError
      );
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

      expect(() => normalizeSpec(spec)).toThrowError(
        PathParameterMismatchError
      );
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
          orgId: expect.any(Object),
          todoId: expect.any(Object),
        })
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

        expect(() => normalizeSpec(spec)).toThrowError(
          InvalidRequestSchemaError
        );
      }
    );
  });

  describe("canonical and derived response graph validation", () => {
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

    test("keeps an inline derived response local when its canonical parent is present", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const inlineResponse = anInlineResponse("InlineDerivedResponse", {
        derived: {
          parentName: "ParentResponse",
          lineage: ["InlineDerivedResponse"],
          depth: 1,
        },
      });
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, inlineResponse] }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses.map(response => response.name)).toEqual([
        "ParentResponse",
      ]);
      expect(normalizedSpec.resources[0]?.operations[0]?.responses[1]).toEqual({
        responseName: "InlineDerivedResponse",
        source: "inline",
        response: expect.objectContaining({
          name: "InlineDerivedResponse",
          kind: "derived-response",
          derivedFrom: "ParentResponse",
          lineage: ["InlineDerivedResponse"],
          depth: 1,
        }),
      });
    });

    test("keeps an inline derived response local when its parent is a derived canonical response", () => {
      const rootResponse = aCanonicalResponse("RootResponse");
      const childResponse = defineDerivedResponse(rootResponse, {
        name: "ChildResponse",
      });
      const inlineGrandchildResponse = anInlineResponse(
        "InlineGrandchildResponse",
        {
          derived: {
            parentName: "ChildResponse",
            lineage: ["ChildResponse", "InlineGrandchildResponse"],
            depth: 2,
          },
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              responses: [
                rootResponse,
                childResponse,
                inlineGrandchildResponse,
              ],
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses.map(response => response.name)).toEqual([
        "RootResponse",
        "ChildResponse",
      ]);
      expect(normalizedSpec.resources[0]?.operations[0]?.responses[2]).toEqual({
        responseName: "InlineGrandchildResponse",
        source: "inline",
        response: expect.objectContaining({
          name: "InlineGrandchildResponse",
          kind: "derived-response",
          derivedFrom: "ChildResponse",
          lineage: ["ChildResponse", "InlineGrandchildResponse"],
          depth: 2,
        }),
      });
    });

    test("rejects derived response metadata whose lineage length disagrees with depth", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = withDerivedMetadata(
        aCanonicalResponse("ChildResponse"),
        {
          parentName: "ParentResponse",
          lineage: ["ChildResponse"],
          depth: 2,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, childResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects derived response metadata with empty lineage", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = withDerivedMetadata(
        aCanonicalResponse("ChildResponse"),
        {
          parentName: "ParentResponse",
          lineage: [],
          depth: 0,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, childResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects multi-level derived response metadata whose immediate parent disagrees with lineage", () => {
      const rootResponse = aCanonicalResponse("RootResponse");
      const grandchildResponse = withDerivedMetadata(
        aCanonicalResponse("GrandchildResponse"),
        {
          parentName: "RootResponse",
          lineage: ["IntermediateResponse", "GrandchildResponse"],
          depth: 2,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [rootResponse, grandchildResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects derived response metadata whose lineage repeats a response name", () => {
      const childResponse = aCanonicalResponse("ChildResponse");
      const grandchildResponse = withDerivedMetadata(
        aCanonicalResponse("GrandchildResponse"),
        {
          parentName: "ChildResponse",
          lineage: [
            "ChildResponse",
            "GrandchildResponse",
            "GrandchildResponse",
          ],
          depth: 3,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [childResponse, grandchildResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
    });

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

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

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
});
