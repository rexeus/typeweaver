import { describe, expect, expectTypeOf, test } from "vitest";
import { z } from "zod";
import { defineOperation } from "../../src/defineOperation.js";
import { defineResponse } from "../../src/defineResponse.js";
import { defineSpec } from "../../src/defineSpec.js";
import { DuplicateResponseNameError } from "../../src/DuplicateResponseNameError.js";
import { HttpMethod } from "../../src/HttpMethod.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import type { OperationDefinition } from "../../src/defineOperation.js";
import type { ResponseDefinition } from "../../src/defineResponse.js";

const aResponseNamed = (
  name: string,
  overrides: Partial<
    Pick<ResponseDefinition, "description" | "statusCode">
  > = {}
): ResponseDefinition => {
  return defineResponse({
    name,
    statusCode: HttpStatusCode.OK,
    description: `${name} response`,
    ...overrides,
  });
};

const anOperationReturning = (
  operationId: string,
  ...responses: readonly ResponseDefinition[]
): OperationDefinition => {
  return defineOperation({
    operationId,
    path: `/${operationId}`,
    method: HttpMethod.GET,
    summary: `${operationId} operation`,
    request: {},
    responses,
  });
};

const anAuthoredUserSpec = () => {
  const body = z.object({ id: z.string() });
  const header = z.object({ "x-request-id": z.string() });
  const response = defineResponse({
    name: "GetUserSuccess",
    statusCode: HttpStatusCode.OK,
    description: "User found",
    body,
    header,
  });
  const operation = defineOperation({
    operationId: "getUser",
    path: "/users/:id",
    method: HttpMethod.GET,
    summary: "Get user",
    request: {
      param: z.object({ id: z.string().uuid() }),
    },
    responses: [response] as const,
  });
  const definition = {
    resources: {
      users: {
        operations: [operation] as const,
      },
    },
  };

  return { body, definition, header, operation, response };
};

const captureThrownError = (act: () => void): unknown => {
  try {
    act();
  } catch (error) {
    return error;
  }

  throw new Error("Expected defineSpec to throw.");
};

describe("defineSpec", () => {
  test("returns the authored spec definition instance", () => {
    const { definition } = anAuthoredUserSpec();

    const spec = defineSpec(definition);

    expect(spec).toBe(definition);
  });

  test("preserves authored operation and response fields for consumers", () => {
    const { definition } = anAuthoredUserSpec();

    const spec = defineSpec(definition);

    expect(spec.resources.users.operations[0]).toMatchObject({
      operationId: "getUser",
      path: "/users/:id",
      method: HttpMethod.GET,
      summary: "Get user",
    });
    expect(spec.resources.users.operations[0].responses[0]).toMatchObject({
      name: "GetUserSuccess",
      statusCode: HttpStatusCode.OK,
      description: "User found",
    });
  });

  test("preserves authored response schema identities", () => {
    const { body, definition, header } = anAuthoredUserSpec();

    const spec = defineSpec(definition);

    expect(spec.resources.users.operations[0].responses[0].body).toBe(body);
    expect(spec.resources.users.operations[0].responses[0].header).toBe(header);
  });

  test("preserves spec literal types for generated consumers", () => {
    const { definition } = anAuthoredUserSpec();

    const spec = defineSpec(definition);

    expectTypeOf(
      spec.resources.users.operations[0].operationId
    ).toEqualTypeOf<"getUser">();
    expectTypeOf(
      spec.resources.users.operations[0].responses[0].name
    ).toEqualTypeOf<"GetUserSuccess">();
  });

  test("accepts a spec with no resources", () => {
    const spec = defineSpec({ resources: {} });

    expect(spec.resources).toEqual({});
  });

  test("accepts resources with no operations", () => {
    const spec = defineSpec({
      resources: {
        users: { operations: [] },
      },
    });

    expect(spec.resources.users.operations).toEqual([]);
  });

  test("accepts operations with empty responses and preserves the empty array", () => {
    const emptyResponses = [] as const satisfies readonly ResponseDefinition[];
    const operation = defineOperation({
      operationId: "getUser",
      path: "/users/:id",
      method: HttpMethod.GET,
      summary: "Get user",
      request: {},
      responses: emptyResponses,
    });

    const spec = defineSpec({
      resources: {
        users: { operations: [operation] as const },
      },
    });

    expect(spec.resources.users.operations[0].responses).toBe(emptyResponses);
  });

  test("accepts globally unique response names across resources", () => {
    expect(() =>
      defineSpec({
        resources: {
          users: {
            operations: [
              anOperationReturning("getUser", aResponseNamed("GetUserSuccess")),
            ],
          },
          sessions: {
            operations: [
              anOperationReturning(
                "createSession",
                aResponseNamed("CreateSessionSuccess", {
                  statusCode: HttpStatusCode.CREATED,
                })
              ),
            ],
          },
        },
      })
    ).not.toThrow();
  });

  test("rejects duplicate response names within a single operation", () => {
    const error = captureThrownError(() => {
      defineSpec({
        resources: {
          users: {
            operations: [
              anOperationReturning(
                "getUser",
                aResponseNamed("SharedError"),
                aResponseNamed("SharedError", {
                  statusCode: HttpStatusCode.UNAUTHORIZED,
                })
              ),
            ],
          },
        },
      });
    });

    expect(error).toBeInstanceOf(DuplicateResponseNameError);
    expect(error).toHaveProperty(
      "message",
      "Response name 'SharedError' must be globally unique within a spec."
    );
  });

  test("rejects duplicate response names across operations in one resource", () => {
    const error = captureThrownError(() => {
      defineSpec({
        resources: {
          users: {
            operations: [
              anOperationReturning("getUser", aResponseNamed("SharedError")),
              anOperationReturning(
                "updateUser",
                aResponseNamed("SharedError", {
                  statusCode: HttpStatusCode.UNAUTHORIZED,
                })
              ),
            ],
          },
        },
      });
    });

    expect(error).toBeInstanceOf(DuplicateResponseNameError);
    expect(error).toHaveProperty(
      "message",
      "Response name 'SharedError' must be globally unique within a spec."
    );
  });

  test("rejects duplicate response names across resources", () => {
    const error = captureThrownError(() => {
      defineSpec({
        resources: {
          users: {
            operations: [
              anOperationReturning("getUser", aResponseNamed("SharedError")),
            ],
          },
          sessions: {
            operations: [
              anOperationReturning(
                "createSession",
                aResponseNamed("SharedError", {
                  statusCode: HttpStatusCode.UNAUTHORIZED,
                })
              ),
            ],
          },
        },
      });
    });

    expect(error).toBeInstanceOf(DuplicateResponseNameError);
    expect(error).toHaveProperty(
      "message",
      "Response name 'SharedError' must be globally unique within a spec."
    );
  });

  test("rejects distinct but structurally identical response definitions with the same name", () => {
    const error = captureThrownError(() => {
      defineSpec({
        resources: {
          users: {
            operations: [
              anOperationReturning("getUser", aResponseNamed("SharedError")),
            ],
          },
          sessions: {
            operations: [
              anOperationReturning(
                "createSession",
                aResponseNamed("SharedError")
              ),
            ],
          },
        },
      });
    });

    expect(error).toBeInstanceOf(DuplicateResponseNameError);
    expect(error).toHaveProperty(
      "message",
      "Response name 'SharedError' must be globally unique within a spec."
    );
  });

  test("allows reusing the same named response definition", () => {
    const sharedResponse = aResponseNamed("SharedError", {
      statusCode: HttpStatusCode.BAD_REQUEST,
    });

    const spec = defineSpec({
      resources: {
        users: {
          operations: [anOperationReturning("getUser", sharedResponse)],
        },
        sessions: {
          operations: [anOperationReturning("createSession", sharedResponse)],
        },
      },
    });

    expect(spec.resources.users.operations[0]?.responses[0]).toBe(
      sharedResponse
    );
    expect(spec.resources.sessions.operations[0]?.responses[0]).toBe(
      sharedResponse
    );
  });
});
