import { describe, expect, test } from "vitest";
import { z } from "zod";
import { defineOperation } from "../../src/defineOperation.js";
import { defineResponse } from "../../src/defineResponse.js";
import { HttpMethod } from "../../src/HttpMethod.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import { ReservedPathParameterError } from "../../src/ReservedPathParameter.js";

describe("defineOperation", () => {
  test("returns the authored operation definition instance", () => {
    const definition = {
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      summary: "List todos",
      request: {},
      responses: [],
    } as const;

    const operation = defineOperation(definition);

    expect(operation).toBe(definition);
  });

  test("exposes authored operation fields for consumers", () => {
    const request = {
      param: z.object({ todoId: z.string().uuid() }),
      query: z.object({ includeCompleted: z.string().optional() }),
    };
    const successResponse = defineResponse({
      name: "TodoResponse",
      statusCode: HttpStatusCode.OK,
      description: "Todo response",
      body: z.object({ id: z.string(), title: z.string() }),
    });

    const operation = defineOperation({
      operationId: "getTodo",
      method: HttpMethod.GET,
      path: "/todos/:todoId",
      summary: "Get todo",
      request,
      responses: [successResponse] as const,
    });

    expect(operation.operationId).toBe("getTodo");
    expect(operation.method).toBe(HttpMethod.GET);
    expect(operation.path).toBe("/todos/:todoId");
    expect(operation.summary).toBe("Get todo");
    expect(operation.request).toBe(request);
    expect(operation.responses).toEqual([successResponse]);
  });

  test("preserves request and response references", () => {
    const request = {
      query: z.object({ page: z.string().optional() }),
    };
    const response = defineResponse({
      name: "TodoResponse",
      statusCode: HttpStatusCode.OK,
      description: "Todo response",
    });
    const responses = [response] as const;

    const operation = defineOperation({
      operationId: "getTodo",
      method: HttpMethod.GET,
      path: "/todos/:todoId",
      summary: "Get todo",
      request,
      responses,
    });

    expect(operation.request).toBe(request);
    expect(operation.responses).toBe(responses);
    expect(operation.responses[0]).toBe(response);
  });

  test("accepts operations without request constraints or responses", () => {
    const request = {};
    const responses = [] as const;

    const operation = defineOperation({
      operationId: "deleteTodo",
      method: HttpMethod.DELETE,
      path: "/todos/:todoId",
      summary: "Delete todo",
      request,
      responses,
    });

    expect(operation.request).toBe(request);
    expect(operation.responses).toBe(responses);
  });
});

describe("defineOperation reserved path parameters", () => {
  test.each([
    "/todos/:__proto__",
    "/files/:__proto__.:format",
    "/:__proto__-suffix",
    "/files/:__proto__{suffix}",
    "/:__proto__!suffix",
    "/a/:x/:__proto__",
  ])("rejects the reserved path parameter in %s at runtime", (path: string) => {
    expect(() =>
      defineOperation({
        operationId: "reservedPath",
        method: HttpMethod.GET,
        path,
        summary: "Reserved path parameter",
        request: {},
        responses: [],
      })
    ).toThrow(ReservedPathParameterError);
  });

  test("accepts constructor and toString path parameters", () => {
    const operation = defineOperation({
      operationId: "readByGeneratedNames",
      method: HttpMethod.GET,
      path: "/todos/:constructor/:toString",
      summary: "Ordinary path parameter names",
      request: {},
      responses: [],
    });

    expect(operation.path).toBe("/todos/:constructor/:toString");
  });

  test("preserves ordinary embedded placeholders", () => {
    const operation = defineOperation({
      operationId: "readFileFormat",
      method: HttpMethod.GET,
      path: "/files/:fileId.:format",
      summary: "Ordinary embedded placeholders",
      request: {},
      responses: [],
    });

    expect(operation.path).toBe("/files/:fileId.:format");
  });
});
