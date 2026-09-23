import {
  createCreateTodoSuccessResponse,
  createQueryTodoSuccessResponse,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { createUnvalidatedTodoHonoWithHandlers } from "./fixtures.js";

describe("Generated Hono form and query parsing", () => {
  test("parses repeated form-url-encoded fields into safe records when validation is disabled", async () => {
    let handlerBody: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body as Record<string, unknown>;
        return createCreateTodoSuccessResponse({
          body: {
            title: handlerBody["title"] as string,
            priority: handlerBody["priority"] as "HIGH",
          },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "title=first&title=second&priority=HIGH",
    });

    expect(response.status).toBe(201);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["title"]).toEqual(["first", "second"]);
    expect(data["priority"]).toBe("HIGH");
    expect(
      Object.getPrototypeOf(handlerBody as Record<string, unknown>)
    ).toBeNull();
  });

  test("preserves repeated empty query parameter values when validation is disabled", async () => {
    let handlerQuery: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async request => {
        handlerQuery = request.query as Record<string, unknown>;
        return createQueryTodoSuccessResponse({
          body: {
            results: [],
            nextToken: handlerQuery["nextToken"] as string,
          },
        });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query?nextToken=&nextToken=second",
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data["nextToken"]).toEqual(["", "second"]);
    expect(handlerQuery?.["nextToken"]).toEqual(["", "second"]);
  });

  test("does not pollute Object.prototype from form-url-encoded __proto__ fields", async () => {
    let handlerBody: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body as Record<string, unknown>;
        return createCreateTodoSuccessResponse({
          body: { title: String(handlerBody["title"]) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "title=safe&__proto__=polluted",
    });

    expect(response.status).toBe(201);
    expect(handlerBody?.["title"]).toBe("safe");
    expect(
      Object.getPrototypeOf(handlerBody as Record<string, unknown>)
    ).toBeNull();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  test("does not pollute Object.prototype from query string __proto__ values", async () => {
    let handlerQuery: Record<string, unknown> | undefined;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async request => {
        handlerQuery = request.query as Record<string, unknown>;
        return createQueryTodoSuccessResponse({
          body: { results: [], nextToken: String(handlerQuery["nextToken"]) },
        });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query?nextToken=safe&__proto__=polluted",
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    expect(handlerQuery?.["nextToken"]).toBe("safe");
    expect(
      Object.getPrototypeOf(handlerQuery as Record<string, unknown>)
    ).toBeNull();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});
