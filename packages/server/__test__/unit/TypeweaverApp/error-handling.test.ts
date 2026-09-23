import {
  HttpMethod,
  internalServerErrorDefaultError,
  methodNotAllowedDefaultError,
  notFoundDefaultError,
  RequestValidationError,
  validationDefaultError,
} from "@rexeus/typeweaver-core";
import type {
  IRawHttpRequest,
  IRequestValidator,
  ITypedHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { TypeweaverApp } from "../../../src/lib/TypeweaverApp.js";
import { TypeweaverRouter } from "../../../src/lib/TypeweaverRouter.js";
import {
  del,
  expectArray,
  expectErrorResponse,
  expectJson,
  expectRecord,
  get,
  noopResponseValidator,
  post,
} from "../../helpers.js";
import { createApp, createValidatingApp, defaultHandlers } from "./fixtures.js";
import type { TypeweaverRouterOptions } from "../../../src/lib/TypeweaverRouter.js";
import type { TestHandlers } from "./fixtures.js";

const bodyOnlyFailingValidator: IRequestValidator = {
  validate: () => {
    throw new RequestValidationError({
      bodyIssues: [
        {
          code: "invalid_type",
          expected: "string",
          input: 42,
          message: "Expected string",
          path: ["title"],
        },
      ],
    });
  },
  safeValidate: () => ({
    isValid: false,
    error: new RequestValidationError(),
  }),
};

class BodyOnlyValidatingRouter extends TypeweaverRouter<TestHandlers> {
  constructor(options: TypeweaverRouterOptions<TestHandlers>) {
    super(options);

    this.route({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      requestValidator: bodyOnlyFailingValidator,
      responseValidator: noopResponseValidator,
      handler: async (req: IRawHttpRequest, ctx) =>
        this.requestHandlers.handleCreateTodo(req, ctx),
    });
  }
}

type ValidationIssueList = readonly unknown[] | undefined;

type ValidationIssues = {
  readonly header: ValidationIssueList;
  readonly body: ValidationIssueList;
  readonly query: ValidationIssueList;
  readonly param: ValidationIssueList;
};

const readIssueList = (
  issues: Record<string, unknown>,
  key: string
): ValidationIssueList => {
  const list = issues[key];
  if (list === undefined) return undefined;
  expectArray(list, `the ${key} validation issues`);
  return list;
};

const readValidationIssues = (
  data: Record<string, unknown>
): ValidationIssues => {
  const issues = data["issues"];
  expectRecord(issues, "the validation issues");
  return {
    header: readIssueList(issues, "header"),
    body: readIssueList(issues, "body"),
    query: readIssueList(issues, "query"),
    param: readIssueList(issues, "param"),
  };
};

describe("Error Handling", () => {
  test("should handle validation errors with default handler and not call onError", async () => {
    const onError = vi.fn();
    const app = createValidatingApp(undefined, undefined, { onError });

    const res = await app.fetch(post("/todos", { title: "bad" }));

    const data = await expectErrorResponse(
      res,
      validationDefaultError.statusCode,
      validationDefaultError.code
    );
    const issues = readValidationIssues(data);
    expect(data["issues"]).toBeDefined();
    expect(issues.header?.[0]).toEqual({
      message: "bad header",
      path: [],
    });
    expect(issues.header?.[0]).not.toHaveProperty("code");
    expect(issues.body?.[0]).toEqual({ message: "bad body", path: [] });
    expect(issues.body?.[0]).not.toHaveProperty("code");
    expect(onError).not.toHaveBeenCalled();
  });

  test("should omit empty issue categories from sanitized response", async () => {
    const app = new TypeweaverApp();
    const router = new BodyOnlyValidatingRouter({
      requestHandlers: defaultHandlers(),
    });
    app.route(router);

    const res = await app.fetch(post("/todos", { title: 123 }));

    const data = await expectErrorResponse(
      res,
      validationDefaultError.statusCode,
      validationDefaultError.code
    );
    const issues = readValidationIssues(data);
    expect(issues.body).toHaveLength(1);
    expect(issues.body?.[0]).toEqual({
      message: "Expected string",
      path: ["title"],
    });
    expect(issues.body?.[0]).not.toHaveProperty("code");
    expect(issues.body?.[0]).not.toHaveProperty("expected");
    expect(issues.body?.[0]).not.toHaveProperty("input");
    expect(issues.header).toBeUndefined();
    expect(issues.query).toBeUndefined();
    expect(issues.param).toBeUndefined();
  });

  test("should handle validation errors with custom handler", async () => {
    const app = createValidatingApp({
      handleRequestValidationErrors: async err => ({
        statusCode: 422,
        body: { custom: true, message: err["message"] },
      }),
    });

    const res = await app.fetch(post("/todos", {}));

    const data = await expectJson(res, 422);
    expect(data["custom"]).toBe(true);
  });
});

describe("TypeweaverApp typed response error handling", () => {
  test("should handle HttpResponse errors with default handler and not call onError", async () => {
    const onError = vi.fn();
    const app = createApp(
      undefined,
      {
        handleCreateTodo: async () => {
          throw {
            type: "ConflictError",
            statusCode: 409,
            header: {},
            body: { code: "CONFLICT" },
          } satisfies ITypedHttpResponse;
        },
      },
      { onError }
    );

    const res = await app.fetch(post("/todos", { title: "dup" }));

    await expectErrorResponse(res, 409, "CONFLICT");
    expect(onError).not.toHaveBeenCalled();
  });

  test("should handle HttpResponse errors with custom handler", async () => {
    const app = createApp(
      {
        validateResponses: false,
        handleHttpResponseErrors: async err => ({
          statusCode: err.statusCode,
          body: { wrapped: true, original: err.body },
        }),
      },
      {
        handleCreateTodo: async () => {
          throw {
            type: "ConflictError",
            statusCode: 409,
            header: {},
            body: { code: "CONFLICT" },
          } satisfies ITypedHttpResponse;
        },
      }
    );

    const res = await app.fetch(post("/todos", {}));

    const data = await expectJson(res, 409);
    expect(data["wrapped"]).toBe(true);
  });

  test("should handle unknown errors with default handler and call onError", async () => {
    const onError = vi.fn();
    const app = createApp(
      undefined,
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Unexpected failure");
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(data)).not.toContain("Unexpected failure");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("TypeweaverApp unknown error handling", () => {
  test("should handle unknown errors with custom handler", async () => {
    const app = createApp(
      {
        handleUnknownErrors: async (err, _ctx) => ({
          statusCode: 500,
          body: {
            custom: true,
            message: err instanceof Error ? err["message"] : "Unknown",
          },
        }),
      },
      {
        handleGetTodos: async () => {
          throw new TestApplicationError("Boom");
        },
      }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 500);
    expect(data["custom"]).toBe(true);
    expect(data["message"]).toBe("Boom");
  });

  test("reports unknown route errors once when a custom unknown error handler returns a response", async () => {
    const onError = vi.fn();
    const routeFailure = new TestApplicationError(
      "custom handler owns response"
    );
    const app = createApp(
      {
        handleUnknownErrors: error => ({
          statusCode: 500,
          body: {
            code: "CUSTOM_UNKNOWN",
            message: error instanceof Error ? error["message"] : "Unknown",
          },
        }),
      },
      {
        handleGetTodos: async () => {
          throw routeFailure;
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    const data = await expectJson(res, 500);
    expect(data).toEqual({
      code: "CUSTOM_UNKNOWN",
      message: "custom handler owns response",
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(routeFailure);
  });

  test("reports both the custom unknown handler failure and original route failure to onError in order", async () => {
    const onError = vi.fn();
    const handlerFailure = new TestApplicationError(
      "custom unknown handler failed"
    );
    const routeFailure = new TestApplicationError("unexpected failure");
    const app = createApp(
      {
        handleUnknownErrors: () => {
          throw handlerFailure;
        },
      },
      {
        handleGetTodos: async () => {
          throw routeFailure;
        },
      },
      { onError }
    );

    const res = await app.fetch(get("/todos"));

    await expectErrorResponse(res, 500, "INTERNAL_SERVER_ERROR");
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(1, handlerFailure);
    expect(onError).toHaveBeenNthCalledWith(2, routeFailure);
  });
});

describe("Default error descriptors", () => {
  test("should use core default descriptors for built-in runtime errors", async () => {
    const app = createApp(undefined, {
      handleGetTodos: async () => {
        throw new TestApplicationError("Unexpected failure");
      },
    });

    const notFoundResponse = await app.fetch(get("/missing"));
    const notFoundData = await expectErrorResponse(
      notFoundResponse,
      notFoundDefaultError.statusCode,
      notFoundDefaultError.code
    );
    expect(notFoundData["message"]).toBe(notFoundDefaultError["message"]);

    const methodNotAllowedResponse = await app.fetch(del("/todos"));
    const methodNotAllowedData = await expectErrorResponse(
      methodNotAllowedResponse,
      methodNotAllowedDefaultError.statusCode,
      methodNotAllowedDefaultError.code
    );
    expect(methodNotAllowedData["message"]).toBe(
      methodNotAllowedDefaultError["message"]
    );

    const internalServerErrorResponse = await app.fetch(get("/todos"));
    const internalServerErrorData = await expectErrorResponse(
      internalServerErrorResponse,
      internalServerErrorDefaultError.statusCode,
      internalServerErrorDefaultError.code
    );
    expect(internalServerErrorData["message"]).toBe(
      internalServerErrorDefaultError["message"]
    );
  });
});
