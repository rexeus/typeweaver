import {
  HttpResponse,
  RequestValidationError,
} from "@rexeus/typeweaver-core";
import type {
  HttpMethod,
  IHttpRequest,
  IHttpResponse,
  IRequestValidator,
  SafeRequestValidationResult,
} from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  TypeweaverRouter,
  type TypeweaverRouterOptions,
} from "../../src/lib/TypeweaverRouter";
import type { RequestHandler } from "../../src/lib/RequestHandler";

// ── Test helpers ──────────────────────────────────────────────────

type TestHandler = {
  handleGetItems: RequestHandler<IHttpRequest, IHttpResponse>;
  handleCreateItem: RequestHandler<IHttpRequest, IHttpResponse>;
  handleGetItem: RequestHandler<IHttpRequest, IHttpResponse>;
  handleUpdateItem: RequestHandler<IHttpRequest, IHttpResponse>;
  handleDeleteItem: RequestHandler<IHttpRequest, IHttpResponse>;
};

class TestRouter extends TypeweaverRouter<TestHandler> {
  public constructor(options: TypeweaverRouterOptions<TestHandler>) {
    super(options);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.addRoute(
      "GET" as HttpMethod,
      "/items",
      passThroughValidator(),
      this.requestHandlers.handleGetItems.bind(this.requestHandlers) as any
    );
    this.addRoute(
      "POST" as HttpMethod,
      "/items",
      passThroughValidator(),
      this.requestHandlers.handleCreateItem.bind(this.requestHandlers) as any
    );
    this.addRoute(
      "GET" as HttpMethod,
      "/items/:itemId",
      passThroughValidator(),
      this.requestHandlers.handleGetItem.bind(this.requestHandlers) as any
    );
    this.addRoute(
      "PUT" as HttpMethod,
      "/items/:itemId",
      passThroughValidator(),
      this.requestHandlers.handleUpdateItem.bind(this.requestHandlers) as any
    );
    this.addRoute(
      "DELETE" as HttpMethod,
      "/items/:itemId",
      passThroughValidator(),
      this.requestHandlers.handleDeleteItem.bind(this.requestHandlers) as any
    );
  }
}

function passThroughValidator(): IRequestValidator {
  return {
    validate: (request: IHttpRequest) => request,
    safeValidate: (
      request: IHttpRequest
    ): SafeRequestValidationResult<IHttpRequest> => ({
      isValid: true,
      data: request,
    }),
  };
}

function failingValidator(message?: string): IRequestValidator {
  return {
    validate: () => {
      throw new RequestValidationError({
        bodyIssues: [
          {
            code: "invalid_type" as any,
            message: message ?? "Invalid body",
            path: ["name"],
            expected: "string",
            received: "number",
          } as any,
        ],
      });
    },
    safeValidate: (
      request: IHttpRequest
    ): SafeRequestValidationResult<IHttpRequest> => ({
      isValid: false,
      error: new RequestValidationError(),
    }),
  };
}

function createHandlers(): TestHandler {
  return {
    handleGetItems: async () => ({
      statusCode: 200,
      body: { items: [] },
    }),
    handleCreateItem: async (req: IHttpRequest) => ({
      statusCode: 201,
      body: { created: true, name: req.body?.name },
    }),
    handleGetItem: async (req: IHttpRequest) => ({
      statusCode: 200,
      body: { id: req.param?.itemId },
    }),
    handleUpdateItem: async (req: IHttpRequest) => ({
      statusCode: 200,
      body: { id: req.param?.itemId, ...req.body },
    }),
    handleDeleteItem: async (req: IHttpRequest) => ({
      statusCode: 204,
    }),
  };
}

function makeRequest(
  method: HttpMethod,
  path: string,
  body?: unknown
): IHttpRequest {
  return {
    method,
    path,
    body,
    header: { "content-type": "application/json" },
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("TypeweaverRouter", () => {
  describe("Route Matching", () => {
    test("should match GET /items", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(makeRequest("GET" as HttpMethod, "/items"));

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(200);
      expect(response!.body).toEqual({ items: [] });
    });

    test("should match POST /items", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("POST" as HttpMethod, "/items", { name: "Test" })
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(201);
      expect(response!.body).toEqual({ created: true, name: "Test" });
    });

    test("should match GET /items/:itemId and extract param", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/items/abc-123")
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(200);
      expect(response!.body).toEqual({ id: "abc-123" });
    });

    test("should return undefined for unmatched routes", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/unknown")
      );

      expect(response).toBeUndefined();
    });

    test("should return undefined for wrong HTTP method", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("PATCH" as HttpMethod, "/items")
      );

      expect(response).toBeUndefined();
    });

    test("should not match if path has extra segments", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/items/abc/extra")
      );

      expect(response).toBeUndefined();
    });

    test("should not match if path has fewer segments", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("DELETE" as HttpMethod, "/")
      );

      expect(response).toBeUndefined();
    });

    test("should handle URL-encoded path params", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/items/hello%20world")
      );

      expect(response).toBeDefined();
      expect(response!.body).toEqual({ id: "hello world" });
    });

    test("should ignore query string when matching routes", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/items?status=active")
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(200);
    });

    test("should handle trailing slashes", async () => {
      const router = new TestRouter({
        requestHandlers: createHandlers(),
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/items/")
      );

      // /items/ with trailing slash should match /items (normalized)
      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(200);
    });
  });

  describe("Nested Path Params", () => {
    type NestedHandler = {
      handleGetSubItem: RequestHandler<IHttpRequest, IHttpResponse>;
    };

    class NestedRouter extends TypeweaverRouter<NestedHandler> {
      public constructor(options: TypeweaverRouterOptions<NestedHandler>) {
        super(options);
        this.addRoute(
          "GET" as HttpMethod,
          "/items/:itemId/subitems/:subitemId",
          passThroughValidator(),
          this.requestHandlers.handleGetSubItem.bind(
            this.requestHandlers
          ) as any
        );
      }
    }

    test("should extract multiple path params", async () => {
      const router = new NestedRouter({
        requestHandlers: {
          handleGetSubItem: async (req: IHttpRequest) => ({
            statusCode: 200,
            body: {
              itemId: req.param?.itemId,
              subitemId: req.param?.subitemId,
            },
          }),
        },
      });

      const response = await router.handle(
        makeRequest("GET" as HttpMethod, "/items/parent-1/subitems/child-2")
      );

      expect(response).toBeDefined();
      expect(response!.body).toEqual({
        itemId: "parent-1",
        subitemId: "child-2",
      });
    });
  });

  describe("Request Validation", () => {
    type SingleHandler = {
      handleCreate: RequestHandler<IHttpRequest, IHttpResponse>;
    };

    class ValidatingRouter extends TypeweaverRouter<SingleHandler> {
      public constructor(
        options: TypeweaverRouterOptions<SingleHandler>,
        validator: IRequestValidator
      ) {
        super(options);
        this.addRoute(
          "POST" as HttpMethod,
          "/things",
          validator,
          this.requestHandlers.handleCreate.bind(
            this.requestHandlers
          ) as any
        );
      }
    }

    test("should return 400 on validation error (default handler)", async () => {
      const router = new ValidatingRouter(
        {
          requestHandlers: {
            handleCreate: async () => ({
              statusCode: 201,
              body: { ok: true },
            }),
          },
        },
        failingValidator("name is required")
      );

      const response = await router.handle(
        makeRequest("POST" as HttpMethod, "/things", {})
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(400);
      expect((response!.body as any).code).toBe("VALIDATION_ERROR");
    });

    test("should skip validation when validateRequests is false", async () => {
      const router = new ValidatingRouter(
        {
          requestHandlers: {
            handleCreate: async () => ({
              statusCode: 201,
              body: { ok: true },
            }),
          },
          validateRequests: false,
        },
        failingValidator()
      );

      const response = await router.handle(
        makeRequest("POST" as HttpMethod, "/things", {})
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(201);
    });

    test("should use custom validation error handler", async () => {
      const router = new ValidatingRouter(
        {
          requestHandlers: {
            handleCreate: async () => ({
              statusCode: 201,
              body: { ok: true },
            }),
          },
          handleValidationErrors: (error) => ({
            statusCode: 422,
            body: { custom: true, message: error.message },
          }),
        },
        failingValidator()
      );

      const response = await router.handle(
        makeRequest("POST" as HttpMethod, "/things", {})
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(422);
      expect((response!.body as any).custom).toBe(true);
    });
  });

  describe("Error Handling", () => {
    type ErrorHandler = {
      handleAction: RequestHandler<IHttpRequest, IHttpResponse>;
    };

    class ErrorRouter extends TypeweaverRouter<ErrorHandler> {
      public constructor(options: TypeweaverRouterOptions<ErrorHandler>) {
        super(options);
        this.addRoute(
          "POST" as HttpMethod,
          "/action",
          passThroughValidator(),
          this.requestHandlers.handleAction.bind(
            this.requestHandlers
          ) as any
        );
      }
    }

    test("should handle HttpResponse errors with default handler", async () => {
      const router = new ErrorRouter({
        requestHandlers: {
          handleAction: async () => {
            throw new HttpResponse(409, undefined, {
              code: "CONFLICT",
              message: "Already exists",
            });
          },
        },
      });

      const response = await router.handle(
        makeRequest("POST" as HttpMethod, "/action")
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(409);
      expect((response!.body as any).code).toBe("CONFLICT");
    });

    test("should handle unknown errors with default handler", async () => {
      const router = new ErrorRouter({
        requestHandlers: {
          handleAction: async () => {
            throw new Error("Something went wrong");
          },
        },
      });

      const response = await router.handle(
        makeRequest("POST" as HttpMethod, "/action")
      );

      expect(response).toBeDefined();
      expect(response!.statusCode).toBe(500);
      expect((response!.body as any).code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should propagate errors when handlers are disabled", async () => {
      const router = new ErrorRouter({
        requestHandlers: {
          handleAction: async () => {
            throw new Error("boom");
          },
        },
        handleUnknownErrors: false,
      });

      await expect(
        router.handle(makeRequest("POST" as HttpMethod, "/action"))
      ).rejects.toThrow("boom");
    });
  });
});
