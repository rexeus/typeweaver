import {
  createCreateTodoSuccessResponse,
  createQueryTodoSuccessResponse,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { readField, readJsonRecord, withBodyFields } from "../../../helpers.js";
import {
  createUnvalidatedTodoHonoWithHandlers,
  createUnvalidatedTodoHonoWithUncheckedHandlers,
} from "./fixtures.js";

describe("Generated Hono form and query parsing", () => {
  test("parses repeated form-url-encoded fields into safe records when validation is disabled", async () => {
    let handlerBody: unknown;
    const app = createUnvalidatedTodoHonoWithUncheckedHandlers({
      CreateTodo: async request => {
        handlerBody = request.body;
        return withBodyFields(createCreateTodoSuccessResponse(), {
          title: readField(request.body, "title"),
          priority: readField(request.body, "priority"),
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "title=first&title=second&priority=HIGH",
    });

    expect(response.status).toBe(201);
    const data = await readJsonRecord(response);
    expect(data["title"]).toEqual(["first", "second"]);
    expect(data["priority"]).toBe("HIGH");
    expect(Object.getPrototypeOf(handlerBody)).toBeNull();
  });

  test("preserves repeated empty query parameter values when validation is disabled", async () => {
    let handlerQuery: unknown;
    const app = createUnvalidatedTodoHonoWithUncheckedHandlers({
      QueryTodo: async request => {
        handlerQuery = request.query;
        return withBodyFields(createQueryTodoSuccessResponse(), {
          results: [],
          nextToken: readField(request.query, "nextToken"),
        });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query?nextToken=&nextToken=second",
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    const data = await readJsonRecord(response);
    expect(data["nextToken"]).toEqual(["", "second"]);
    expect(readField(handlerQuery, "nextToken")).toEqual(["", "second"]);
  });

  test("does not pollute Object.prototype from form-url-encoded __proto__ fields", async () => {
    let handlerBody: unknown;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleCreateTodoRequest: async request => {
        handlerBody = request.body;
        return createCreateTodoSuccessResponse({
          body: { title: String(readField(request.body, "title")) },
        });
      },
    });

    const response = await app.request("http://localhost/todos", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "title=safe&__proto__=polluted",
    });

    expect(response.status).toBe(201);
    expect(readField(handlerBody, "title")).toBe("safe");
    expect(Object.getPrototypeOf(handlerBody)).toBeNull();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  test("does not pollute Object.prototype from query string __proto__ values", async () => {
    let handlerQuery: unknown;
    const app = createUnvalidatedTodoHonoWithHandlers({
      handleQueryTodoRequest: async request => {
        handlerQuery = request.query;
        return createQueryTodoSuccessResponse({
          body: {
            results: [],
            nextToken: String(readField(request.query, "nextToken")),
          },
        });
      },
    });

    const response = await app.request(
      "http://localhost/todos/query?nextToken=safe&__proto__=polluted",
      { method: "POST" }
    );

    expect(response.status).toBe(200);
    expect(readField(handlerQuery, "nextToken")).toBe("safe");
    expect(Object.getPrototypeOf(handlerQuery)).toBeNull();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});
