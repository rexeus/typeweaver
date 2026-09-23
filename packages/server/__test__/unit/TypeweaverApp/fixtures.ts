import {
  HttpMethod,
  internalServerErrorDefaultError,
  RequestValidationError,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IRawHttpRequest,
  IRequestValidator,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import { expect, vi } from "vitest";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../../src/lib/TypeweaverRouter.js";
import {
  expectErrorResponse,
  isUnknownRecord,
  noopResponseValidator,
  noopValidator,
} from "../../helpers.js";
import type { RequestHandler } from "../../../src/lib/RequestHandler.js";
import type { TypeweaverAppOptions } from "../../../src/lib/TypeweaverApp.js";
import type { TypeweaverRouterOptions } from "../../../src/lib/TypeweaverRouter.js";

export const failingValidator: IRequestValidator = {
  validate: () => {
    throw new RequestValidationError({
      headerIssues: [{ code: "custom", message: "bad header", path: [] }],
      bodyIssues: [{ code: "custom", message: "bad body", path: [] }],
    });
  },
  safeValidate: () => ({
    isValid: false,
    error: new RequestValidationError(),
  }),
};

export type ConsoleErrorSpy = {
  mockRestore: () => void;
};

export type TestHandlers = {
  handleGetTodos: RequestHandler;
  handleCreateTodo: RequestHandler;
  handleGetTodo: RequestHandler;
};

export class TestRouter extends TypeweaverRouter<TestHandlers, boolean> {
  constructor(options: TypeweaverRouterOptions<TestHandlers, boolean>) {
    super(options);

    this.route({
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      requestValidator:
        options.validateRequests === false ? noopValidator : failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodos(req, ctx),
    });

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator:
        options.validateRequests === false ? noopValidator : failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
    });

    this.route({
      operationId: "getTodo",
      method: HttpMethod.GET,
      path: "/todos/:todoId",
      requestValidator:
        options.validateRequests === false ? noopValidator : failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleGetTodo(req, ctx),
    });
  }
}

export class ValidatingTestRouter extends TypeweaverRouter<
  TestHandlers,
  boolean
> {
  constructor(options: TypeweaverRouterOptions<TestHandlers, boolean>) {
    super(options);

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator: failingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
    });
  }
}

export function defaultHandlers(
  overrides: Partial<TestHandlers> = {}
): TestHandlers {
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

export function createApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers, boolean>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new TestRouter({
    validateRequests: false,
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

export function createValidatingApp(
  routerOptions?: Partial<TypeweaverRouterOptions<TestHandlers, boolean>>,
  handlerOverrides?: Partial<TestHandlers>,
  appOptions?: TypeweaverAppOptions
): TypeweaverApp {
  const app = new TypeweaverApp(appOptions);
  const router = new ValidatingTestRouter({
    validateRequests: true,
    requestHandlers: defaultHandlers(handlerOverrides),
    ...routerOptions,
  });
  app.route(router);
  return app;
}

export async function withConsoleErrorSpy<T>(
  fn: (spy: ConsoleErrorSpy) => Promise<T> | T
): Promise<T> {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    return await fn(spy);
  } finally {
    spy.mockRestore();
  }
}

export const invalidResponseValidator: IResponseValidator = {
  validate: (response: IHttpResponse) => {
    throw new ResponseValidationError(response.statusCode);
  },
  safeValidate: (response: IHttpResponse) => ({
    isValid: false,
    error: new ResponseValidationError(response.statusCode),
  }),
};

export class ResponseValidatingRouter extends TypeweaverRouter<
  TestHandlers,
  boolean
> {
  constructor(
    options: TypeweaverRouterOptions<TestHandlers, boolean> & {
      readonly responseValidator?: IResponseValidator;
    }
  ) {
    super(options);

    this.route({
      operationId: "listTodos",
      method: HttpMethod.GET,
      path: "/todos",
      requestValidator: noopValidator,
      responseValidator: options.responseValidator ?? invalidResponseValidator,
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

export function createResponseValidatingApp(
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

export async function expectInternalError(
  res: Response
): Promise<Record<string, unknown>> {
  return expectErrorResponse(
    res,
    internalServerErrorDefaultError.statusCode,
    internalServerErrorDefaultError.code
  );
}

export class CustomResponseValidatingRouter extends TypeweaverRouter<
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

export async function expectNoBody(res: Response): Promise<void> {
  expect(await res.text()).toBe("");
}
