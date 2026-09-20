import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IValidatedHttpRequest,
} from "@rexeus/typeweaver-core";
import { describe, expect, expectTypeOf, test } from "vitest";
import { createData } from "../../src/data/createData.js";
import { createRequest } from "../../src/data/createRequest.js";
import { createResponse } from "../../src/data/createResponse.js";
import { ServerTodoHandlers } from "../../src/test-server/handlers/ServerTodoHandlers.js";
import { TodoHandlers } from "../../src/test-server/handlers/TodoHandlers.js";

const handlerFactories = [
  ["Fetch-native", () => new ServerTodoHandlers()],
  ["Hono", () => new TodoHandlers()],
] as const;

type Overrides<T> = Exclude<Parameters<typeof createData<T>>[1], undefined>;

describe("test data factory overrides", () => {
  test("only permits undefined overrides where the source type does", () => {
    expectTypeOf<{ required: undefined }>().not.toMatchTypeOf<
      Overrides<{ required: string }>
    >();
    expectTypeOf<{ optional: undefined }>().toMatchTypeOf<
      Overrides<{ optional?: string }>
    >();
    expectTypeOf<{ required: undefined }>().toMatchTypeOf<
      Overrides<{ required: string | undefined }>
    >();
    expect(
      createData<{ optional?: string }>(
        { optional: "default" },
        { optional: undefined }
      )
    ).toEqual({ optional: undefined });
  });

  test("applies explicitly provided falsy request parts", () => {
    const request = createRequest<
      IValidatedHttpRequest,
      boolean,
      string,
      number,
      boolean
    >(
      { method: HttpMethod.POST, path: "/default" },
      {
        body: (input = true) => input,
        header: (input = "default-header") => input,
        param: (input = 1) => input,
        query: (input = true) => input,
      },
      { path: "", body: false, header: "", param: 0, query: false }
    );

    expect(request).toEqual({
      method: HttpMethod.POST,
      path: "",
      body: false,
      header: "",
      param: 0,
      query: false,
    });
  });

  test("applies explicitly provided falsy response parts", () => {
    const response = createResponse<IHttpResponse, boolean, string>(
      { statusCode: HttpStatusCode.OK },
      {
        body: (input = true) => input,
        header: (input = "default-header") => input,
      },
      { body: false, header: "" }
    );

    expect(response).toEqual({
      statusCode: HttpStatusCode.OK,
      body: false,
      header: "",
    });
  });
});

describe.each(handlerFactories)(
  "%s update handlers",
  (_name, createHandlers) => {
    test("preserves required todo defaults for undefined patch fields", async () => {
      const response = await createHandlers().handleUpdateTodoRequest({
        method: HttpMethod.PATCH,
        path: "/todos/todo-1",
        param: { todoId: "todo-1" },
        body: { description: undefined, title: undefined },
      });

      expect(response.type).toBe("UpdateTodoSuccess");
      if (response.type !== "UpdateTodoSuccess") {
        throw new Error("Expected an UpdateTodoSuccess response");
      }
      expect(response.body.id).toBe("todo-1");
      expect(response.body.description).toBeUndefined();
      expect(typeof response.body.title).toBe("string");
    });

    test("preserves required subtodo defaults for undefined patch fields", async () => {
      const response = await createHandlers().handleUpdateSubTodoRequest({
        method: HttpMethod.PUT,
        path: "/todos/todo-1/subtodos/subtodo-1",
        param: { todoId: "todo-1", subtodoId: "subtodo-1" },
        body: {
          description: undefined,
          status: undefined,
          title: undefined,
        },
      });

      expect(response.type).toBe("UpdateSubTodoSuccess");
      if (response.type !== "UpdateSubTodoSuccess") {
        throw new Error("Expected an UpdateSubTodoSuccess response");
      }
      expect(response.body.id).toBe("subtodo-1");
      expect(response.body.parentId).toBe("todo-1");
      expect(response.body.description).toBeUndefined();
      expect(typeof response.body.status).toBe("string");
      expect(typeof response.body.title).toBe("string");
    });
  }
);
