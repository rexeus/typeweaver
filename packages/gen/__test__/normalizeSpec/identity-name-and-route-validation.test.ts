import { HttpMethod } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  DuplicateOperationIdError,
  DuplicateResponseNameError,
  DuplicateRouteError,
  InvalidOperationIdError,
  InvalidResourceNameError,
} from "../../src/index.js";
import {
  aCanonicalResponse,
  aMalformedSpec,
  anInlineResponse,
  anOperation,
  aSpec,
  captureNormalizeError,
  normalizeSpec,
} from "./fixtures.js";

describe("normalizeSpec identity and name validation", () => {
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

    const error = captureNormalizeError(spec);
    expect(error).toBeInstanceOf(InvalidOperationIdError);
    expect((error as InvalidOperationIdError).operationId).toBe(operationId);
  });

  test.each([
    { scenario: "snake_case", resourceName: "user_profile" },
    { scenario: "kebab-case", resourceName: "user-profile" },
    { scenario: "leading digit", resourceName: "1userProfile" },
  ])("rejects $scenario resource names", ({ resourceName }) => {
    const spec = aSpec({
      [resourceName]: { operations: [anOperation()] },
    });

    const error = captureNormalizeError(spec);
    expect(error).toBeInstanceOf(InvalidResourceNameError);
    expect((error as InvalidResourceNameError).resourceName).toBe(resourceName);
  });
});

describe("normalizeSpec response name validation", () => {
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

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
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

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
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

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
  });
});

describe("normalizeSpec route validation", () => {
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
});

describe("normalizeSpec embedded route validation", () => {
  test("distinguishes bare and embedded parameterized routes", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      files: {
        operations: [
          anOperation({
            operationId: "getFile",
            path: "/files/:fileId",
            request: { param: z.object({ fileId: z.string() }) },
            responses: [okResponse],
          }),
          anOperation({
            operationId: "getFileFormat",
            path: "/files/:fileId.:format",
            request: {
              param: z.object({ fileId: z.string(), format: z.string() }),
            },
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(normalizeSpec(spec).resources[0]?.operations).toHaveLength(2);
  });

  test("rejects renamed embedded routes with the same literal shape", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      files: {
        operations: [
          anOperation({
            operationId: "getFileFormat",
            path: "/files/:fileId.:format",
            request: {
              param: z.object({ fileId: z.string(), format: z.string() }),
            },
            responses: [okResponse],
          }),
          anOperation({
            operationId: "getNamedFileFormat",
            path: "/files/:name.:extension",
            request: {
              param: z.object({ name: z.string(), extension: z.string() }),
            },
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
  });
});
