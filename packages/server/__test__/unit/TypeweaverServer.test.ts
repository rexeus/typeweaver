import type {
  HttpMethod,
  IHttpRequest,
  IHttpResponse,
  IRequestValidator,
  SafeRequestValidationResult,
} from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TypeweaverRouter,
  type TypeweaverRouterOptions,
} from "../../src/lib/TypeweaverRouter";
import { TypeweaverServer } from "../../src/lib/TypeweaverServer";
import type { RequestHandler } from "../../src/lib/RequestHandler";

// ── Test helpers ──────────────────────────────────────────────────

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

type SimpleHandler = {
  handleGetItems: RequestHandler<IHttpRequest, IHttpResponse>;
  handleCreateItem: RequestHandler<IHttpRequest, IHttpResponse>;
  handleGetItem: RequestHandler<IHttpRequest, IHttpResponse>;
};

class SimpleRouter extends TypeweaverRouter<SimpleHandler> {
  public constructor(options: TypeweaverRouterOptions<SimpleHandler>) {
    super(options);
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
  }
}

function createTestRouter(): SimpleRouter {
  return new SimpleRouter({
    requestHandlers: {
      handleGetItems: async () => ({
        statusCode: 200,
        body: { items: ["a", "b"] },
      }),
      handleCreateItem: async (req: IHttpRequest) => ({
        statusCode: 201,
        body: { name: req.body?.name },
      }),
      handleGetItem: async (req: IHttpRequest) => ({
        statusCode: 200,
        body: { id: req.param?.itemId },
      }),
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────

describe("TypeweaverServer", () => {
  describe("Fetch Handler (Deno/Bun)", () => {
    test("should route requests to mounted router", async () => {
      const server = new TypeweaverServer({ healthCheck: false, requestId: false });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: ["a", "b"] });
    });

    test("should extract path params", async () => {
      const server = new TypeweaverServer({ healthCheck: false, requestId: false });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items/abc-123")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "abc-123" });
    });

    test("should return 404 for unmatched routes", async () => {
      const server = new TypeweaverServer({ healthCheck: false, requestId: false });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/unknown")
      );

      expect(response.status).toBe(404);
    });

    test("should parse JSON body", async () => {
      const server = new TypeweaverServer({ healthCheck: false, requestId: false });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Item" }),
        })
      );

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ name: "Test Item" });
    });
  });

  describe("Health Check", () => {
    test("should respond with default health check", async () => {
      const server = new TypeweaverServer({ requestId: false });

      const response = await server.fetch(
        new Request("http://localhost/health")
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
    });

    test("should use custom health check function", async () => {
      const server = new TypeweaverServer({
        requestId: false,
        healthCheck: {
          check: () => ({ status: "ok", db: "connected" }),
        },
      });

      const response = await server.fetch(
        new Request("http://localhost/health")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: "ok",
        db: "connected",
      });
    });

    test("should use custom health check path", async () => {
      const server = new TypeweaverServer({
        requestId: false,
        healthCheck: { path: "/healthz" },
      });

      const notFound = await server.fetch(
        new Request("http://localhost/health")
      );
      expect(notFound.status).toBe(404);

      const found = await server.fetch(
        new Request("http://localhost/healthz")
      );
      expect(found.status).toBe(200);
    });

    test("should return 503 when health check throws", async () => {
      const server = new TypeweaverServer({
        requestId: false,
        healthCheck: {
          check: () => {
            throw new Error("Database down");
          },
        },
      });

      const response = await server.fetch(
        new Request("http://localhost/health")
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data).toEqual({
        status: "error",
        message: "Database down",
      });
    });

    test("should disable health check when set to false", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      const response = await server.fetch(
        new Request("http://localhost/health")
      );

      expect(response.status).toBe(404);
    });
  });

  describe("Request ID", () => {
    test("should add X-Request-Id header", async () => {
      const server = new TypeweaverServer({ healthCheck: false });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(200);
      const requestId = response.headers.get("X-Request-Id");
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/
      );
    });

    test("should preserve existing X-Request-Id", async () => {
      const server = new TypeweaverServer({ healthCheck: false });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items", {
          headers: { "X-Request-Id": "existing-id-123" },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Request-Id")).toBe("existing-id-123");
    });

    test("should not add X-Request-Id when disabled", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.headers.get("X-Request-Id")).toBeNull();
    });
  });

  describe("Base Path", () => {
    test("should strip basePath before routing", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/api/v1/items")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: ["a", "b"] });
    });

    test("should 404 without basePath prefix", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(404);
    });

    test("should apply basePath to health check", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        requestId: false,
      });

      const response = await server.fetch(
        new Request("http://localhost/api/v1/health")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });
  });

  describe("Middleware", () => {
    test("should execute middleware before handlers", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      server.use(async (request, next) => {
        const response = await next();
        return {
          ...response,
          header: {
            ...(response.header as Record<string, string>),
            "X-Custom": "middleware-applied",
          },
        };
      });

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Custom")).toBe("middleware-applied");
    });

    test("should execute middleware in order", async () => {
      const order: string[] = [];
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      server.use(async (_req, next) => {
        order.push("first-before");
        const res = await next();
        order.push("first-after");
        return res;
      });

      server.use(async (_req, next) => {
        order.push("second-before");
        const res = await next();
        order.push("second-after");
        return res;
      });

      await server.fetch(new Request("http://localhost/items"));

      expect(order).toEqual([
        "first-before",
        "second-before",
        "second-after",
        "first-after",
      ]);
    });

    test("should allow middleware to short-circuit", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      server.use(async () => ({
        statusCode: 401,
        body: { message: "Unauthorized" },
      }));

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: "Unauthorized" });
    });

    test("should support chaining use()", () => {
      const server = new TypeweaverServer();

      const result = server
        .use(async (_req, next) => next())
        .use(async (_req, next) => next());

      expect(result).toBe(server);
    });
  });

  describe("Multiple Routers", () => {
    test("should try routers in order", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      type PingHandler = {
        handlePing: RequestHandler<IHttpRequest, IHttpResponse>;
      };

      class PingRouter extends TypeweaverRouter<PingHandler> {
        public constructor(options: TypeweaverRouterOptions<PingHandler>) {
          super(options);
          this.addRoute(
            "GET" as HttpMethod,
            "/ping",
            passThroughValidator(),
            this.requestHandlers.handlePing.bind(
              this.requestHandlers
            ) as any
          );
        }
      }

      server.route("/", createTestRouter());
      server.route(
        "/",
        new PingRouter({
          requestHandlers: {
            handlePing: async () => ({
              statusCode: 200,
              body: "pong",
            }),
          },
        })
      );

      const itemsResponse = await server.fetch(
        new Request("http://localhost/items")
      );
      expect(itemsResponse.status).toBe(200);

      const pingResponse = await server.fetch(
        new Request("http://localhost/ping")
      );
      expect(pingResponse.status).toBe(200);
      expect(await pingResponse.text()).toBe("pong");
    });
  });

  describe("Node.js Server Lifecycle", () => {
    let server: TypeweaverServer;

    afterEach(async () => {
      if (server?.isRunning) {
        await server.stop();
      }
    });

    test("should start and stop", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      const onStarted = vi.fn();
      const onStopping = vi.fn();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        healthCheck: false,
        requestId: false,
        hooks: { onStarted, onStopping },
      });

      expect(server.isRunning).toBe(false);

      await server.start();
      expect(server.isRunning).toBe(true);
      expect(onStarted).toHaveBeenCalledWith({
        port,
        hostname: "0.0.0.0",
      });

      await server.stop();
      expect(server.isRunning).toBe(false);
      expect(onStopping).toHaveBeenCalledOnce();
    });

    test("should throw when starting twice", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
      });

      await server.start();
      await expect(server.start()).rejects.toThrow(
        "Server is already running."
      );
    });

    test("should serve requests via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      await server.start();

      const response = await fetch(`http://localhost:${port}/items`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: ["a", "b"] });
    });

    test("should serve path params via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      await server.start();

      const response = await fetch(`http://localhost:${port}/items/xyz`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "xyz" });
    });

    test("should parse JSON body via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      await server.start();

      const response = await fetch(`http://localhost:${port}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "From Node" }),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ name: "From Node" });
    });

    test("should serve health check via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        requestId: false,
      });

      await server.start();

      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
    });

    test("should add X-Request-Id via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        healthCheck: false,
      });
      server.route("/", createTestRouter());

      await server.start();

      const response = await fetch(`http://localhost:${port}/items`);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Request-Id")).toBeTruthy();
    });

    test("should apply basePath via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        basePath: "/api/v1",
        gracefulShutdown: false,
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());

      await server.start();

      const ok = await fetch(`http://localhost:${port}/api/v1/items`);
      expect(ok.status).toBe(200);

      const notFound = await fetch(`http://localhost:${port}/items`);
      expect(notFound.status).toBe(404);
    });

    test("should apply middleware via Node.js http", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        healthCheck: false,
        requestId: false,
      });
      server.route("/", createTestRouter());
      server.use(async (req, next) => {
        const res = await next();
        return {
          ...res,
          header: {
            ...(res.header as Record<string, string>),
            "X-Middleware": "active",
          },
        };
      });

      await server.start();

      const response = await fetch(`http://localhost:${port}/items`);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Middleware")).toBe("active");
    });
  });
});
