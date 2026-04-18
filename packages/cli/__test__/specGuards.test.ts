import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { isSpecDefinition } from "../src/generators/spec/specGuards.js";

describe("isSpecDefinition", () => {
  test("accepts a structurally valid spec definition", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: 200,
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(true);
  });

  test("accepts responses with enum-backed HTTP status codes", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: HttpStatusCode.OK,
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(true);
  });

  test("rejects resources without an operations array", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {},
        },
      })
    ).toBe(false);
  });

  test("rejects operations missing a summary field", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                request: {},
                responses: [],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects operations with invalid HTTP methods", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "FETCH",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects responses missing required fields", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [
                  {
                    name: "TodoResponse",
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects responses with out-of-range HTTP status codes", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: 299,
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects operations with an empty responses array", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects operations with an undefined request", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: undefined,
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: 200,
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects null input", () => {
    expect(isSpecDefinition(null)).toBe(false);
  });

  test("rejects undefined input", () => {
    expect(isSpecDefinition(undefined)).toBe(false);
  });

  test("rejects non-object resources", () => {
    expect(isSpecDefinition({ resources: [1, 2] })).toBe(false);
  });
});
