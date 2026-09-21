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
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { TypeweaverApp } from "../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../src/lib/TypeweaverRouter.js";
import {
  expectErrorResponse,
  expectJson,
  get,
  noopValidator,
} from "../helpers.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";
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

describe("TypeweaverApp response validation failures", () => {
  test("returns the original invalid response when response validation handling is disabled", async () => {
    const app = createResponseValidatingApp(
      { handleResponseValidationErrors: false },
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          header: { "x-invalid": "yes" },
          body: { invalid: true },
        }),
      }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 200);
    expect(data).toEqual({ invalid: true });
    expect(res.headers.get("x-invalid")).toBe("yes");
  });

  test("returns a sanitized 500 when the custom response validation handler throws", async () => {
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "response validation handler failed"
    );
    const app = createResponseValidatingApp(
      {
        handleResponseValidationErrors: () => {
          throw handlerFailure;
        },
      },
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: { secret: "invalid response detail" },
        }),
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectInternalError(res);
    expect(JSON.stringify(data)).not.toContain("invalid response detail");
  });

  test("reports onError when the custom response validation handler throws", async () => {
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "response validation handler failed"
    );
    const app = createResponseValidatingApp(
      {
        handleResponseValidationErrors: () => {
          throw handlerFailure;
        },
      },
      {
        handleGetTodos: async () => ({
          statusCode: 200,
          body: { invalid: true },
        }),
      },
      { onError }
    );

    await app.fetch(get("/todos"));

    expect(onError).toHaveBeenCalledWith(handlerFailure);
  });
});
