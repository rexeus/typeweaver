import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createDeleteTodoRequest,
  createDeleteTodoSuccessResponse,
  createOptionsTodoRequest,
  createOptionsTodoSuccessResponse,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  aCreateTodoSuccessResponseWithBody,
  buildCreateTodoSuccess,
  prepareRequestData,
} from "../../../helpers.js";
import {
  createCreateTodoRouteReturning,
  createTodoHonoWithHandlers,
  expectJson,
  expectSanitizedInternalServerError,
  createTodoRouteReturning,
  requestCreateTodo,
} from "./fixtures.js";
import type { TodoHonoTestOptions } from "./fixtures.js";

function createCreateTodoRouteThrowing(
  response: ITypedHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoHonoWithHandlers(
    {
      handleCreateTodoRequest: async () => {
        throw response;
      },
    },
    options
  );
}

function createDeleteTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoRouteReturning("DeleteTodo", response, options);
}

function createOptionsTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoRouteReturning("optionsTodo", response, options);
}

async function requestDeleteTodo(app: TodoHono<false>): Promise<Response> {
  const requestData = createDeleteTodoRequest();
  return await app.request(
    `http://localhost/todos/${requestData.param.todoId}`,
    prepareRequestData(requestData)
  );
}

async function requestOptionsTodo(app: TodoHono<false>): Promise<Response> {
  const requestData = createOptionsTodoRequest();
  return await app.request(
    `http://localhost/todos/${requestData.param.todoId}`,
    prepareRequestData(requestData)
  );
}

describe("bodyless and same-status response variants", () => {
  test("strips an unexpected body from a header-only 204 response", async () => {
    const responseWithAccidentalBody: ITypedHttpResponse = {
      ...createDeleteTodoSuccessResponse(),
      body: { accidental: "body" },
    };
    const app = createDeleteTodoRouteReturning(responseWithAccidentalBody);

    const response = await requestDeleteTodo(app);

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  test("matches the headerless 204 response by HTTP shape rather than runtime type", async () => {
    const headerlessResponseWithWrongType: ITypedHttpResponse = {
      type: "DeleteTodoSuccess" as const,
      statusCode: 204,
      header: undefined,
      body: { accidental: "body" },
    };
    const app = createDeleteTodoRouteReturning(headerlessResponseWithWrongType);

    const response = await requestDeleteTodo(app);

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
    expect(response.headers.get("content-type")).toBeNull();
  });

  test("strips an unexpected body from an OPTIONS header-only response", async () => {
    const responseWithAccidentalBody: ITypedHttpResponse = {
      ...createOptionsTodoSuccessResponse(),
      body: { accidental: "body" },
    };
    const app = createOptionsTodoRouteReturning(responseWithAccidentalBody);

    const response = await requestOptionsTodo(app);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("");
    expect(response.headers.get("allow")).toBe(
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
    );
  });
});

describe("returned and thrown typed response parity", () => {
  test.each([
    {
      mode: "returned",
      createApp: (response: ITypedHttpResponse) =>
        createCreateTodoRouteReturning(response),
    },
    {
      mode: "thrown",
      createApp: (response: ITypedHttpResponse) =>
        createCreateTodoRouteThrowing(response),
    },
  ])(
    "validates and strips valid typed responses from $mode handlers",
    async ({ createApp }) => {
      const typedResponse = buildCreateTodoSuccess({
        extraField: "typed-response-extra",
      });
      const app = createApp(typedResponse);

      const response = await requestCreateTodo(app);

      const data = await expectJson(response, 201);
      expect(data).not.toHaveProperty("extraField");
      expect(data["id"]).toBe(typedResponse.body.id);
    }
  );

  test.each([
    {
      mode: "returned",
      createApp: (response: ITypedHttpResponse) =>
        createCreateTodoRouteReturning(response),
    },
    {
      mode: "thrown",
      createApp: (response: ITypedHttpResponse) =>
        createCreateTodoRouteThrowing(response),
    },
  ])(
    "fails closed for invalid typed responses from $mode handlers",
    async ({ createApp }) => {
      const app = createApp(
        aCreateTodoSuccessResponseWithBody({
          id: 12345,
          secret: "typed-response-secret",
        })
      );

      const response = await requestCreateTodo(app);

      const data = await expectSanitizedInternalServerError(response);
      expect(JSON.stringify(data)).not.toContain("typed-response-secret");
    }
  );
});
