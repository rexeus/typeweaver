import {
  DuplicateResponseNameError,
  defineDerivedResponse,
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
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
} from "../src";

describe("normalizeSpec", () => {
  test("normalizes canonical and inline responses separately", () => {
    const okResponse = defineResponse({
      name: "OkResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
      body: z.object({ ok: z.literal(true) }),
    });
    const createdResponse = defineDerivedResponse(okResponse, {
      name: "CreatedResponse",
      statusCode: HttpStatusCode.CREATED,
      description: "Created",
      body: z.object({ id: z.string() }),
    });
    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "listTodos",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "List todos",
              request: {
                param: z.object({ todoId: z.string() }),
                query: z.object({ page: z.string().optional() }),
              },
              responses: [
                okResponse,
                createdResponse,
                {
                  name: "ListTodosInlineResponse",
                  statusCode: HttpStatusCode.BAD_REQUEST,
                  description: "Bad request",
                  body: z.object({ message: z.string() }),
                },
              ],
            }),
          ],
        },
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses).toHaveLength(2);
    expect(normalizedSpec.responses).toEqual([
      expect.objectContaining({
        name: "OkResponse",
        kind: "response",
        statusCode: HttpStatusCode.OK,
      }),
      expect.objectContaining({
        name: "CreatedResponse",
        kind: "derived-response",
        derivedFrom: "OkResponse",
        lineage: ["CreatedResponse"],
        depth: 1,
        statusCode: HttpStatusCode.CREATED,
      }),
    ]);

    expect(normalizedSpec.resources).toEqual([
      {
        name: "todos",
        operations: [
          {
            operationId: "listTodos",
            method: HttpMethod.GET,
            path: "/todos/:todoId",
            summary: "List todos",
            request: {
              param: expect.any(Object),
              query: expect.any(Object),
            },
            responses: [
              {
                responseName: "OkResponse",
                source: "canonical",
              },
              {
                responseName: "CreatedResponse",
                source: "canonical",
              },
              {
                responseName: "ListTodosInlineResponse",
                source: "inline",
                response: expect.objectContaining({
                  name: "ListTodosInlineResponse",
                  kind: "response",
                  statusCode: HttpStatusCode.BAD_REQUEST,
                }),
              },
            ],
          },
        ],
      },
    ]);
  });

  test("rejects specs without resources", () => {
    expect(() => normalizeSpec({ resources: {} })).toThrowError(
      EmptySpecResourcesError
    );
  });

  test("rejects resources without operations", () => {
    expect(() =>
      normalizeSpec({
        resources: {
          todos: {
            operations: [],
          },
        },
      })
    ).toThrowError(EmptyResourceOperationsError);
  });

  test("rejects operations without responses", () => {
    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "Get todo",
              request: {},
              responses: [],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(
      EmptyOperationResponsesError
    );
  });

  test("rejects duplicate operation IDs", () => {
    const dummyResponse = defineResponse({
      name: "DummyResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "duplicateOperation",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "List todos",
              request: {},
              responses: [dummyResponse],
            }),
          ],
        },
        accounts: {
          operations: [
            defineOperation({
              operationId: "duplicateOperation",
              method: HttpMethod.GET,
              path: "/accounts",
              summary: "List accounts",
              request: {},
              responses: [dummyResponse],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateOperationIdError);
  });

  test("accepts camelCase operation IDs", () => {
    const spec = defineSpec({
      resources: {
        todo: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.object({ todoId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetTodoResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).not.toThrow();
  });

  test("accepts PascalCase operation IDs", () => {
    const spec = defineSpec({
      resources: {
        todo: {
          operations: [
            defineOperation({
              operationId: "GetTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.object({ todoId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetTodoPascalResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).not.toThrow();
  });

  test("rejects snake_case operation IDs", () => {
    const spec = defineSpec({
      resources: {
        todo: {
          operations: [
            defineOperation({
              operationId: "get_todo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.object({ todoId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetTodoSnakeResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidOperationIdError);
  });

  test("rejects kebab-case operation IDs", () => {
    const spec = defineSpec({
      resources: {
        todo: {
          operations: [
            defineOperation({
              operationId: "get-todo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.object({ todoId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetTodoKebabResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidOperationIdError);
  });

  test("accepts camelCase resource names", () => {
    const spec = defineSpec({
      resources: {
        userProfile: {
          operations: [
            defineOperation({
              operationId: "getUserProfile",
              method: HttpMethod.GET,
              path: "/users/:userId/profile",
              summary: "Get user profile",
              request: {
                param: z.object({ userId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetUserProfileResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).not.toThrow();
  });

  test("accepts PascalCase resource names", () => {
    const spec = defineSpec({
      resources: {
        UserProfile: {
          operations: [
            defineOperation({
              operationId: "getUserProfile",
              method: HttpMethod.GET,
              path: "/users/:userId/profile",
              summary: "Get user profile",
              request: {
                param: z.object({ userId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetPascalUserProfileResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).not.toThrow();
  });

  test("rejects snake_case resource names", () => {
    const spec = defineSpec({
      resources: {
        user_profile: {
          operations: [
            defineOperation({
              operationId: "getUserProfile",
              method: HttpMethod.GET,
              path: "/users/:userId/profile",
              summary: "Get user profile",
              request: {
                param: z.object({ userId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetSnakeUserProfileResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidResourceNameError);
  });

  test("rejects kebab-case resource names", () => {
    const spec = defineSpec({
      resources: {
        "user-profile": {
          operations: [
            defineOperation({
              operationId: "getUserProfile",
              method: HttpMethod.GET,
              path: "/users/:userId/profile",
              summary: "Get user profile",
              request: {
                param: z.object({ userId: z.string() }),
              },
              responses: [
                defineResponse({
                  name: "GetKebabUserProfileResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                }),
              ],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidResourceNameError);
  });

  test("rejects duplicate inline response names when spec validation is bypassed", () => {
    const spec = {
      resources: {
        todos: {
          operations: [
            {
              operationId: "listTodos",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "List todos",
              request: {},
              responses: [
                {
                  name: "DuplicateInlineResponse",
                  statusCode: HttpStatusCode.BAD_REQUEST,
                  description: "Bad request",
                },
              ],
            },
            {
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "Create todo",
              request: {},
              responses: [
                {
                  name: "DuplicateInlineResponse",
                  statusCode: HttpStatusCode.CONFLICT,
                  description: "Conflict",
                },
              ],
            },
          ],
        },
      },
    } as any;

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
  });

  test("rejects inline response names that collide with canonical responses", () => {
    const okResponse = defineResponse({
      name: "TodoResponse",
      statusCode: HttpStatusCode.OK,
      description: "Todo",
    });
    const spec = {
      resources: {
        todos: {
          operations: [
            {
              operationId: "listTodos",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "List todos",
              request: {},
              responses: [okResponse],
            },
            {
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "Create todo",
              request: {},
              responses: [
                {
                  name: "TodoResponse",
                  statusCode: HttpStatusCode.CREATED,
                  description: "Created",
                },
              ],
            },
          ],
        },
      },
    } as any;

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
  });

  test("rejects duplicate normalized routes", () => {
    const dummyResponse = defineResponse({
      name: "DummyResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.object({ todoId: z.string() }),
              },
              responses: [dummyResponse],
            }),
          ],
        },
        accounts: {
          operations: [
            defineOperation({
              operationId: "getAccount",
              method: HttpMethod.GET,
              path: "/todos/:accountId",
              summary: "Get account",
              request: {
                param: z.object({ accountId: z.string() }),
              },
              responses: [dummyResponse],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
  });

  test("rejects path parameter mismatches", () => {
    const dummyResponse = defineResponse({
      name: "DummyResponse",
      statusCode: HttpStatusCode.OK,
      description: "Ok",
    });

    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.object({ id: z.string() }),
              },
              responses: [dummyResponse],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(PathParameterMismatchError);
  });

  test("rejects request.param schemas that are not zod objects", () => {
    const spec = {
      resources: {
        todos: {
          operations: [
            {
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get todo",
              request: {
                param: z.string(),
              },
              responses: [
                {
                  name: "DummyResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                },
              ],
            },
          ],
        },
      },
    } as any;

    expect(() => normalizeSpec(spec)).toThrowError(InvalidRequestSchemaError);
  });

  test("rejects request body values that are not zod schemas", () => {
    const spec = {
      resources: {
        todos: {
          operations: [
            {
              operationId: "createTodo",
              method: HttpMethod.POST,
              path: "/todos",
              summary: "Create todo",
              request: {
                body: { parse: () => ({}) },
              },
              responses: [
                {
                  name: "DummyResponse",
                  statusCode: HttpStatusCode.OK,
                  description: "Ok",
                },
              ],
            },
          ],
        },
      },
    } as any;

    expect(() => normalizeSpec(spec)).toThrowError(InvalidRequestSchemaError);
  });

  test("rejects derived response cycles from malformed metadata", () => {
    const cyclicResponse = defineResponse({
      name: "CyclicResponse",
      statusCode: HttpStatusCode.OK,
      description: "Cycle",
    }) as any;

    Object.defineProperty(cyclicResponse, "derived", {
      value: {
        parentName: "CyclicResponse",
        lineage: ["CyclicResponse"],
        depth: 1,
      },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "Get todo",
              request: {},
              responses: [cyclicResponse],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
  });

  test("rejects derived responses with missing canonical parents", () => {
    const orphanResponse = defineResponse({
      name: "OrphanResponse",
      statusCode: HttpStatusCode.OK,
      description: "Orphan",
    }) as any;

    Object.defineProperty(orphanResponse, "derived", {
      value: {
        parentName: "MissingResponse",
        lineage: ["OrphanResponse"],
        depth: 1,
      },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "Get todo",
              request: {},
              responses: [orphanResponse],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(
      MissingDerivedResponseParentError
    );
  });

  test("rejects invalid derived lineage metadata", () => {
    const baseResponse = defineResponse({
      name: "BaseResponse",
      statusCode: HttpStatusCode.OK,
      description: "Base",
    });
    const invalidResponse = defineDerivedResponse(baseResponse, {
      name: "InvalidResponse",
    }) as any;

    Object.defineProperty(invalidResponse, "derived", {
      value: {
        parentName: "BaseResponse",
        lineage: ["WrongName"],
        depth: 1,
      },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const spec = defineSpec({
      resources: {
        todos: {
          operations: [
            defineOperation({
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos",
              summary: "Get todo",
              request: {},
              responses: [baseResponse, invalidResponse],
            }),
          ],
        },
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(InvalidDerivedResponseError);
  });
});
