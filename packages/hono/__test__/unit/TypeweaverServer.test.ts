import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createListTodosRequest,
  createTestHono,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Hono } from "hono";
import { TypeweaverServer } from "../../src/lib/TypeweaverServer";
import type { IHttpRequest } from "@rexeus/typeweaver-core";

function prepareRequestData(requestData: IHttpRequest): RequestInit {
  const body =
    typeof requestData.body === "string"
      ? requestData.body
      : requestData.body
        ? JSON.stringify(requestData.body)
        : undefined;

  const headers: Headers = new Headers();
  for (const [key, value] of Object.entries(requestData.header || {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }
  return {
    method: requestData.method,
    headers,
    body,
  };
}

describe("TypeweaverServer", () => {
  describe("Constructor & Configuration", () => {
    test("should create server with default options", () => {
      const server = new TypeweaverServer();

      expect(server).toBeDefined();
      expect(server.app).toBeInstanceOf(Hono);
      expect(server.isRunning).toBe(false);
    });

    test("should create server with custom options", () => {
      const server = new TypeweaverServer({
        port: 8080,
        hostname: "127.0.0.1",
        gracefulShutdown: false,
        shutdownTimeout: 5000,
        requestId: false,
        healthCheck: false,
      });

      expect(server).toBeDefined();
      expect(server.isRunning).toBe(false);
    });
  });

  describe("Health Check", () => {
    test("should respond with default health check on /health", async () => {
      const server = new TypeweaverServer();

      const response = await server.app.request("/health");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
    });

    test("should respond with custom health check data", async () => {
      const server = new TypeweaverServer({
        healthCheck: {
          check: () => ({
            status: "ok",
            version: "1.0.0",
            uptime: 12345,
          }),
        },
      });

      const response = await server.app.request("/health");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        status: "ok",
        version: "1.0.0",
        uptime: 12345,
      });
    });

    test("should respond with async health check data", async () => {
      const server = new TypeweaverServer({
        healthCheck: {
          check: async () => ({
            status: "ok",
            db: "connected",
          }),
        },
      });

      const response = await server.app.request("/health");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok", db: "connected" });
    });

    test("should use custom health check path", async () => {
      const server = new TypeweaverServer({
        healthCheck: {
          path: "/healthz",
        },
      });

      const defaultResponse = await server.app.request("/health");
      expect(defaultResponse.status).toBe(404);

      const customResponse = await server.app.request("/healthz");
      expect(customResponse.status).toBe(200);
      const data = await customResponse.json();
      expect(data).toEqual({ status: "ok" });
    });

    test("should return 503 when health check throws", async () => {
      const server = new TypeweaverServer({
        healthCheck: {
          check: () => {
            throw new Error("Database connection failed");
          },
        },
      });

      const response = await server.app.request("/health");

      expect(response.status).toBe(503);
      const data = (await response.json()) as any;
      expect(data.status).toBe("error");
      expect(data.message).toBe("Database connection failed");
    });

    test("should return 503 when async health check throws", async () => {
      const server = new TypeweaverServer({
        healthCheck: {
          check: async () => {
            throw new Error("Redis timeout");
          },
        },
      });

      const response = await server.app.request("/health");

      expect(response.status).toBe(503);
      const data = (await response.json()) as any;
      expect(data.status).toBe("error");
      expect(data.message).toBe("Redis timeout");
    });

    test("should disable health check when set to false", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
      });

      const response = await server.app.request("/health");

      expect(response.status).toBe(404);
    });

    test("should enable default health check when set to true", async () => {
      const server = new TypeweaverServer({
        healthCheck: true,
      });

      const response = await server.app.request("/health");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
    });
  });

  describe("Middleware (use())", () => {
    test("should register global middleware", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      server.use(async (c, next) => {
        c.header("X-Custom", "middleware-applied");
        await next();
      });

      const router = new Hono();
      router.get("/test", c => c.json({ ok: true }));
      server.route("/", router);

      const response = await server.app.request("/test");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Custom")).toBe("middleware-applied");
    });

    test("should register path-scoped middleware", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      server.use("/admin/*", async (c, next) => {
        c.header("X-Admin", "true");
        await next();
      });

      const router = new Hono();
      router.get("/admin/dashboard", c => c.json({ admin: true }));
      router.get("/public", c => c.json({ public: true }));
      server.route("/", router);

      const adminResponse = await server.app.request("/admin/dashboard");
      expect(adminResponse.status).toBe(200);
      expect(adminResponse.headers.get("X-Admin")).toBe("true");

      const publicResponse = await server.app.request("/public");
      expect(publicResponse.status).toBe(200);
      expect(publicResponse.headers.get("X-Admin")).toBeNull();
    });

    test("should execute middleware in registration order", async () => {
      const order: string[] = [];
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      server.use(async (_c, next) => {
        order.push("first");
        await next();
      });
      server.use(async (_c, next) => {
        order.push("second");
        await next();
      });

      const router = new Hono();
      router.get("/test", c => c.json({ ok: true }));
      server.route("/", router);

      await server.app.request("/test");

      expect(order).toEqual(["first", "second"]);
    });

    test("should support chaining use() calls", () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      const result = server
        .use(async (_c, next) => next())
        .use(async (_c, next) => next());

      expect(result).toBe(server);
    });

    test("should support chaining use() with route()", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/test", c => c.json({ ok: true }));

      server
        .use(async (c, next) => {
          c.header("X-Chained", "yes");
          await next();
        })
        .route("/", router);

      const response = await server.app.request("/test");
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Chained")).toBe("yes");
    });
  });

  describe("Request ID", () => {
    test("should add X-Request-Id header to responses", async () => {
      const server = new TypeweaverServer();

      const simpleRouter = new Hono();
      simpleRouter.get("/test", c => c.json({ ok: true }));
      server.route("/", simpleRouter);

      const response = await server.app.request("/test");

      expect(response.status).toBe(200);
      const requestId = response.headers.get("X-Request-Id");
      expect(requestId).toBeDefined();
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/
      );
    });

    test("should preserve existing X-Request-Id header from incoming request", async () => {
      const server = new TypeweaverServer();

      const simpleRouter = new Hono();
      simpleRouter.get("/test", c => c.json({ ok: true }));
      server.route("/", simpleRouter);

      const existingId = "custom-request-id-123";
      const response = await server.app.request("/test", {
        headers: { "X-Request-Id": existingId },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Request-Id")).toBe(existingId);
    });

    test("should not add X-Request-Id when disabled", async () => {
      const server = new TypeweaverServer({
        requestId: false,
      });

      const simpleRouter = new Hono();
      simpleRouter.get("/test", c => c.json({ ok: true }));
      server.route("/", simpleRouter);

      const response = await server.app.request("/test");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Request-Id")).toBeNull();
    });

    test("should generate unique request IDs per request", async () => {
      const server = new TypeweaverServer();

      const simpleRouter = new Hono();
      simpleRouter.get("/test", c => c.json({ ok: true }));
      server.route("/", simpleRouter);

      const response1 = await server.app.request("/test");
      const response2 = await server.app.request("/test");

      const id1 = response1.headers.get("X-Request-Id");
      const id2 = response2.headers.get("X-Request-Id");

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe("Router Mounting", () => {
    test("should mount a simple Hono router", async () => {
      const server = new TypeweaverServer();

      const router = new Hono();
      router.get("/items", c => c.json({ items: ["a", "b"] }));
      server.route("/", router);

      const response = await server.app.request("/items");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ items: ["a", "b"] });
    });

    test("should mount multiple routers", async () => {
      const server = new TypeweaverServer();

      const router1 = new Hono();
      router1.get("/users", c => c.json({ users: [] }));
      const router2 = new Hono();
      router2.get("/posts", c => c.json({ posts: [] }));

      server.route("/", router1);
      server.route("/", router2);

      const usersResponse = await server.app.request("/users");
      expect(usersResponse.status).toBe(200);
      expect(await usersResponse.json()).toEqual({ users: [] });

      const postsResponse = await server.app.request("/posts");
      expect(postsResponse.status).toBe(200);
      expect(await postsResponse.json()).toEqual({ posts: [] });
    });

    test("should support chaining route() calls", () => {
      const server = new TypeweaverServer();

      const router1 = new Hono();
      router1.get("/a", c => c.json({ a: true }));
      const router2 = new Hono();
      router2.get("/b", c => c.json({ b: true }));

      const result = server.route("/", router1).route("/", router2);

      expect(result).toBe(server);
    });

    test("should mount generated TypeweaverHono routers", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      const testHono = createTestHono();
      server.route("/", testHono);

      const requestData = createListTodosRequest();
      const response = await server.app.request(
        "/todos?status=TODO",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("Base Path (native Hono basePath)", () => {
    test("should apply basePath consistently via app.request()", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      // app.request() works with the full prefixed path
      const response = await server.app.request("/api/v1/items");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: [] });
    });

    test("should 404 without basePath prefix via app.request()", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      const response = await server.app.request("/items");

      expect(response.status).toBe(404);
    });

    test("should apply basePath consistently via fetch handler", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      const response = await server.fetch(
        new Request("http://localhost/api/v1/items")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: [] });
    });

    test("should 404 without basePath prefix via fetch handler", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      const response = await server.fetch(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(404);
    });

    test("should serve health check under basePath", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
      });

      const response = await server.app.request("/api/v1/health");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
    });

    test("should apply middleware under basePath", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      server.use(async (c, next) => {
        c.header("X-Prefixed", "yes");
        await next();
      });

      const router = new Hono();
      router.get("/test", c => c.json({ ok: true }));
      server.route("/", router);

      const response = await server.app.request("/api/v1/test");
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Prefixed")).toBe("yes");
    });

    test("should work with generated TypeweaverHono routers under basePath", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const testHono = createTestHono();
      server.route("/", testHono);

      const requestData = createListTodosRequest();
      const response = await server.app.request(
        "/api/v1/todos?status=TODO",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("Fetch Handler", () => {
    test("should expose a fetch handler for Deno/Bun runtimes", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/ping", c => c.text("pong"));
      server.route("/", router);

      const fetchHandler = server.fetch;
      expect(typeof fetchHandler).toBe("function");

      const response = await fetchHandler(
        new Request("http://localhost/ping")
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("pong");
    });

    test("should return the same handler reference on repeated access", () => {
      const server = new TypeweaverServer();

      const fetch1 = server.fetch;
      const fetch2 = server.fetch;

      expect(fetch1).toBe(fetch2);
    });
  });

  describe("Node.js Server Lifecycle", () => {
    let server: TypeweaverServer;

    afterEach(async () => {
      if (server?.isRunning) {
        await server.stop();
      }
    });

    test("should start and stop the server", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      const onStarted = vi.fn();
      const onStopping = vi.fn();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        hooks: {
          onStarted,
          onStopping,
        },
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

    test("should throw when starting an already running server", async () => {
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

    test("should handle stop() on a non-running server gracefully", async () => {
      server = new TypeweaverServer({
        gracefulShutdown: false,
      });

      // Should not throw
      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    test("should serve HTTP requests on the configured port", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
      });

      const router = new Hono();
      router.get("/ping", c => c.text("pong"));
      server.route("/", router);

      await server.start();

      const response = await fetch(`http://localhost:${port}/ping`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("pong");
    });

    test("should serve health check via real HTTP", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
      });

      await server.start();

      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
    });

    test("should serve generated TypeweaverHono routers via real HTTP", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
      });

      const testHono = createTestHono();
      server.route("/", testHono);

      await server.start();

      const requestData = createListTodosRequest();
      const response = await fetch(
        `http://localhost:${port}/todos?status=TODO`,
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should serve with basePath via real HTTP", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        basePath: "/api/v1",
        gracefulShutdown: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      await server.start();

      const response = await fetch(`http://localhost:${port}/api/v1/items`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: [] });

      const noPrefix = await fetch(`http://localhost:${port}/items`);
      expect(noPrefix.status).toBe(404);
    });

    test("should add X-Request-Id header via real HTTP", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
      });

      const router = new Hono();
      router.get("/test", c => c.json({ ok: true }));
      server.route("/", router);

      await server.start();

      const response = await fetch(`http://localhost:${port}/test`);
      expect(response.status).toBe(200);

      const requestId = response.headers.get("X-Request-Id");
      expect(requestId).toBeTruthy();
    });

    test("should call async onStopping hook during shutdown", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      const cleanupDone = vi.fn();
      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        hooks: {
          onStopping: async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            cleanupDone();
          },
        },
      });

      await server.start();
      await server.stop();

      expect(cleanupDone).toHaveBeenCalledOnce();
    });

    test("should apply middleware via real HTTP", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        requestId: false,
      });

      server.use(async (c, next) => {
        c.header("X-Custom-Middleware", "active");
        await next();
      });

      const router = new Hono();
      router.get("/test", c => c.json({ ok: true }));
      server.route("/", router);

      await server.start();

      const response = await fetch(`http://localhost:${port}/test`);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Custom-Middleware")).toBe("active");
    });
  });
});
