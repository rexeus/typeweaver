import { internalServerErrorDefaultError } from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createDeleteTodoSuccessResponse,
  createOptionsTodoRequest,
  createOptionsTodoSuccessResponse,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  aCreateTodoSuccessResponseWithBody,
  buildCreateTodoSuccess,
  expectErrorResponse,
  prepareRequestData,
} from "../../helpers.js";
import type {
  CreateTodoResponse,
  DeleteTodoResponse,
  HonoTodoApiHandler,
  OptionsTodoResponse,
} from "test-utils";

type TodoHonoTestOptions = Omit<
  ConstructorParameters<typeof TodoHono<false>>[0],
  "requestHandlers" | "validateRequests"
> & { readonly validateRequests?: false };

const unhandledHonoTodoRequest = async (
  handlerName: string
): Promise<never> => {
  throw new TestAssertionError(`Missing Hono test handler: ${handlerName}`);
};

function createTodoHonoWithHandlers(
  handlers: Partial<HonoTodoApiHandler<false>>,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  const requestHandlers = new Proxy(handlers as HonoTodoApiHandler<false>, {
    get: (target, prop) => {
      if (prop in target)
        return target[prop as keyof HonoTodoApiHandler<false>];
      return async () => unhandledHonoTodoRequest(String(prop));
    },
  });

  return new TodoHono<false>({
    validateRequests: false,
    validateResponses: true,
    ...options,
    requestHandlers,
  });
}

function createCreateTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoHonoWithHandlers(
    {
      handleCreateTodoRequest: async () => response as CreateTodoResponse,
    },
    options
  );
}

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
  return createTodoHonoWithHandlers(
    {
      handleDeleteTodoRequest: async () => response as DeleteTodoResponse,
    },
    options
  );
}

function createOptionsTodoRouteReturning(
  response: ITypedHttpResponse,
  options?: TodoHonoTestOptions
): TodoHono<false> {
  return createTodoHonoWithHandlers(
    {
      handleOptionsTodoRequest: async () => response as OptionsTodoResponse,
    },
    options
  );
}

async function requestCreateTodo(app: TodoHono<false>): Promise<Response> {
  return await app.request(
    "http://localhost/todos",
    prepareRequestData(createCreateTodoRequest())
  );
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

async function expectJson(
  response: Response,
  status: number
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);
  return (await response.json()) as Record<string, unknown>;
}

async function expectSanitizedInternalServerError(
  response: Response
): Promise<Record<string, unknown>> {
  const data = await expectErrorResponse(
    response,
    internalServerErrorDefaultError.statusCode,
    internalServerErrorDefaultError.code
  );
  expect(data).toEqual({
    code: internalServerErrorDefaultError.code,
    message: internalServerErrorDefaultError.message,
  });

  return data;
}

describe("validateResponses: false", () => {
  test("passes through extra body fields when response validation is disabled", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-remain",
      secretData: { nested: true },
    });
    const app = createCreateTodoRouteReturning(responseWithExtra, {
      validateResponses: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data["extraField"]).toBe("should-remain");
    expect(data["secretData"]).toEqual({ nested: true });
  });

  test("passes through schema-invalid body values when response validation is disabled", async () => {
    const invalidResponse = aCreateTodoSuccessResponseWithBody({
      id: 12345,
      title: true,
    });
    const app = createCreateTodoRouteReturning(invalidResponse, {
      validateResponses: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(12345);
    expect(data["title"]).toBe(true);
  });

  test("keeps unknown response headers when response validation is disabled", async () => {
    const responseWithUnknownHeader: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "Content-Type": "application/json",
        "X-Trace-Id": "trace-1",
      },
    };
    const app = createCreateTodoRouteReturning(responseWithUnknownHeader, {
      validateResponses: false,
    });

    const response = await requestCreateTodo(app);

    await expectJson(response, 201);
    expect(response.headers.get("x-trace-id")).toBe("trace-1");
  });
});

describe("handleResponseValidationErrors: false", () => {
  test("returns invalid responses as-is when response-validation handling is disabled", async () => {
    const invalidResponse = aCreateTodoSuccessResponseWithBody({
      id: 12345,
      title: true,
    });
    const app = createCreateTodoRouteReturning(invalidResponse, {
      validateResponses: true,
      handleResponseValidationErrors: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(12345);
    expect(data["title"]).toBe(true);
  });

  test("still strips extra fields from valid responses when response-validation error handling is disabled", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-strip",
    });
    const app = createCreateTodoRouteReturning(responseWithExtra, {
      validateResponses: true,
      handleResponseValidationErrors: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data["id"]).toBe(responseWithExtra.body.id);
    expect(data["title"]).toBe(responseWithExtra.body.title);
  });
});

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
