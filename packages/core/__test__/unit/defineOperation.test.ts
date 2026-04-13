import { describe, expect, test } from "vitest";
import { z } from "zod";
import { defineOperation } from "../../src/defineOperation.js";
import { defineResponse } from "../../src/defineResponse.js";
import { HttpMethod } from "../../src/HttpMethod.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";

describe("defineOperation", () => {
  test("returns the original operation definition", () => {
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
});
