import {
  HttpMethod,
  internalServerErrorDefaultError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IRawHttpRequest,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  expectErrorResponse,
  expectJson,
  get,
  noopValidator,
} from "../helpers.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";
import type { ResponseValidationErrorHandler } from "../../src/lib/Router.js";
import type { TypeweaverAppOptions } from "../../src/lib/TypeweaverApp.js";
import type { TypeweaverRouterOptions } from "../../src/lib/TypeweaverRouter.js";

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const invalidResponseValidator: IResponseValidator = {
  validate: (response: IHttpResponse) => {
    throw new ResponseValidationError(response.statusCode);
  },
  safeValidate: (response: IHttpResponse) => ({
    isValid: false,
    error: new ResponseValidationError(response.statusCode),
  }),
};

type TestHandlers = {
  handleGetTodos: RequestHandler;
  handleCreateTodo: RequestHandler;
  handleGetTodo: RequestHandler;
};

class ResponseValidatingRouter extends TypeweaverRouter<TestHandlers, boolean> {
  constructor(options: TypeweaverRouterOptions<TestHandlers, boolean>) {
    super(options);

    this.route({
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      requestValidator: noopValidator,
      responseValidator: invalidResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodos(req, ctx),
    });

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator: noopValidator,
      responseValidator: invalidResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
    });
  }
}

class CustomResponseValidatingRouter extends TypeweaverRouter<
  TestHandlers,
  boolean
> {
  constructor(
    options: TypeweaverRouterOptions<TestHandlers, boolean> & {
      readonly responseValidator: IResponseValidator;
    }
  ) {
    super(options);

    this.route({
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      requestValidator: noopValidator,
      responseValidator: options.responseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodos(req, ctx),
    });
  }
}

function defaultHandlers(overrides: Partial<TestHandlers> = {}): TestHandlers {
  return {
    handleGetTodos: async () => ({
      statusCode: 200,
      body: [
        { id: "1", title: "First" },
        { id: "2", title: "Second" },
      ],
    }),
    handleCreateTodo: async req => {
      const title =
        isUnknownRecord(req.body) && typeof req.body["title"] === "string"
          ? req.body["title"]
          : "Untitled";
      return {
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: "3", title },
      };
    },
    handleGetTodo: async (req, _ctx) => ({
      statusCode: 200,
      body: { id: req.param?.["todoId"] ?? "unknown", title: "A Todo" },
    }),
    ...overrides,
  };
}

function createResponseValidatingApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers, boolean>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new ResponseValidatingRouter({
    validateRequests: false,
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

async function expectInternalError(
  res: Response
): Promise<Record<string, unknown>> {
  return expectErrorResponse(
    res,
    internalServerErrorDefaultError.statusCode,
    internalServerErrorDefaultError.code
  );
}

function anInvalidTodosResponse(): IHttpResponse {
  return {
    statusCode: 200,
    header: { "x-invalid": "yes" },
    body: { invalid: true },
  };
}

describe("Response Validation", () => {
  test("returns validated response data when response validation transforms the handler response", async () => {
    const responseValidator: IResponseValidator = {
      validate: response => ({
        ...response,
        header: { "x-response-source": "validator" },
        body: { title: "validated todo" },
      }),
      safeValidate: response => ({
        isValid: true,
        data: {
          ...response,
          header: { "x-response-source": "validator" },
          body: { title: "validated todo" },
        },
      }),
    };
    const app = new TypeweaverApp();
    const router = new CustomResponseValidatingRouter({
      validateRequests: false,
      responseValidator,
      requestHandlers: defaultHandlers({
        handleGetTodos: async () => ({
          statusCode: 200,
          header: { "x-response-source": "handler" },
          body: {
            title: "raw todo",
            sensitive: "handler-only response detail",
          },
        }),
      }),
    });
    app.route(router);

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ title: "validated todo" });
    expect(res.headers.get("x-response-source")).toBe("validator");
  });

  test("returns the handler response unchanged when response validation is disabled", async () => {
    const handlerResponse: IHttpResponse = {
      statusCode: 200,
      header: { "x-response-source": "handler" },
      body: { source: "handler" },
    };
    const responseValidator: IResponseValidator = {
      validate: () => {
        throw new ResponseValidationError(418);
      },
      safeValidate: response => {
        return {
          isValid: true,
          data: {
            ...response,
            statusCode: 202,
            header: { "x-response-source": "validator" },
            body: { source: "validator" },
          },
        };
      },
    };
    const app = new TypeweaverApp();
    const router = new CustomResponseValidatingRouter({
      validateRequests: false,
      validateResponses: false,
      responseValidator,
      requestHandlers: defaultHandlers({
        handleGetTodos: async () => handlerResponse,
      }),
    });
    app.route(router);

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ source: "handler" });
    expect(res.headers.get("x-response-source")).toBe("handler");
  });
});

describe("TypeweaverApp invalid response handling", () => {
  test("returns a sanitized 500 when the default response validation handler handles an invalid response", async () => {
    const app = createResponseValidatingApp(undefined, {
      handleGetTodos: async () => ({
        statusCode: 200,
        body: { leaked: "response validation internals" },
      }),
    });

    const res = await app.fetch(get("/todos"));

    const data = await expectInternalError(res);
    expect(data["message"]).toBe(internalServerErrorDefaultError["message"]);
    expect(JSON.stringify(data)).not.toContain("response validation internals");
  });

  test("returns the custom response validation handler response when a response is invalid", async () => {
    const handler: ResponseValidationErrorHandler = (
      _error,
      _response,
      ctx
    ) => {
      return {
        statusCode: 422,
        body: {
          code: "INVALID_RESPONSE",
          operationId: ctx.route?.operationId,
        },
      };
    };
    const app = createResponseValidatingApp(
      { handleResponseValidationErrors: handler },
      { handleGetTodos: async () => anInvalidTodosResponse() }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 422);
    expect(data).toEqual({
      code: "INVALID_RESPONSE",
      operationId: "listTodos",
    });
  });

  test("passes the validation error, original response, and route metadata to the custom response validation handler", async () => {
    const invalidResponse = anInvalidTodosResponse();
    let captured:
      | {
          readonly error: ResponseValidationError;
          readonly response: IHttpResponse;
          readonly route: unknown;
        }
      | undefined;
    const handler: ResponseValidationErrorHandler = (error, response, ctx) => {
      captured = { error, response, route: ctx.route };
      return {
        statusCode: 422,
        body: { code: "INVALID_RESPONSE" },
      };
    };
    const app = createResponseValidatingApp(
      { handleResponseValidationErrors: handler },
      { handleGetTodos: async () => invalidResponse }
    );

    await app.fetch(get("/todos"));

    expect(captured?.error).toBeInstanceOf(ResponseValidationError);
    expect(captured?.error.statusCode).toBe(200);
    expect(captured?.response).toEqual(invalidResponse);
    expect(captured?.route).toEqual({
      operationId: "listTodos",
      method: "GET",
      path: "/todos",
    });
  });
});
