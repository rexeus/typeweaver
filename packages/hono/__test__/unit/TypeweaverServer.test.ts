import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createListTodosRequest,
  createTestHono,
} from "test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

      const response = await server.app.request("http://localhost/health");

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

      const response = await server.app.request("http://localhost/health");

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

      const response = await server.app.request("http://localhost/health");

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

      const defaultResponse = await server.app.request(
        "http://localhost/health"
      );
      expect(defaultResponse.status).toBe(404);

      const customResponse = await server.app.request(
        "http://localhost/healthz"
      );
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

      const response = await server.app.request("http://localhost/health");

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

      const response = await server.app.request("http://localhost/health");

      expect(response.status).toBe(503);
      const data = (await response.json()) as any;
      expect(data.status).toBe("error");
      expect(data.message).toBe("Redis timeout");
    });

    test("should disable health check when set to false", async () => {
      const server = new TypeweaverServer({
        healthCheck: false,
      });

      const response = await server.app.request("http://localhost/health");

      expect(response.status).toBe(404);
    });

    test("should enable default health check when set to true", async () => {
      const server = new TypeweaverServer({
        healthCheck: true,
      });

      const response = await server.app.request("http://localhost/health");

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
    });
  });

  describe("Request ID", () => {
    test("should add X-Request-Id header to responses", async () => {
      const server = new TypeweaverServer();

      const simpleRouter = new Hono();
      simpleRouter.get("/test", c => c.json({ ok: true }));
      server.route("/", simpleRouter);

      const response = await server.app.request("http://localhost/test");

      expect(response.status).toBe(200);
      const requestId = response.headers.get("X-Request-Id");
      expect(requestId).toBeDefined();
      expect(requestId).toBeTruthy();
      // UUID format: 8-4-4-4-12
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
      const response = await server.app.request("http://localhost/test", {
        headers: {
          "X-Request-Id": existingId,
        },
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

      const response = await server.app.request("http://localhost/test");

      expect(response.status).toBe(200);
      expect(response.headers.get("X-Request-Id")).toBeNull();
    });

    test("should generate unique request IDs per request", async () => {
      const server = new TypeweaverServer();

      const simpleRouter = new Hono();
      simpleRouter.get("/test", c => c.json({ ok: true }));
      server.route("/", simpleRouter);

      const response1 = await server.app.request("http://localhost/test");
      const response2 = await server.app.request("http://localhost/test");

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

      const response = await server.app.request("http://localhost/items");

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

      const usersResponse = await server.app.request(
        "http://localhost/users"
      );
      expect(usersResponse.status).toBe(200);
      expect(await usersResponse.json()).toEqual({ users: [] });

      const postsResponse = await server.app.request(
        "http://localhost/posts"
      );
      expect(postsResponse.status).toBe(200);
      expect(await postsResponse.json()).toEqual({ posts: [] });
    });

    test("should support chaining route() calls", async () => {
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
        "http://localhost/todos?status=TODO",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("Base Path", () => {
    test("should apply base path prefix via fetch handler", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      // Access through the fetch handler (which applies basePath)
      const fetchHandler = server.fetch;
      const response = await fetchHandler(
        new Request("http://localhost/api/v1/items")
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ items: [] });
    });

    test("should not match routes without base path prefix via fetch handler", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
        healthCheck: false,
        requestId: false,
      });

      const router = new Hono();
      router.get("/items", c => c.json({ items: [] }));
      server.route("/", router);

      const fetchHandler = server.fetch;
      const response = await fetchHandler(
        new Request("http://localhost/items")
      );

      expect(response.status).toBe(404);
    });

    test("should expose health check under base path via fetch handler", async () => {
      const server = new TypeweaverServer({
        basePath: "/api/v1",
      });

      const fetchHandler = server.fetch;
      const response = await fetchHandler(
        new Request("http://localhost/api/v1/health")
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ status: "ok" });
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

      await expect(server.start()).rejects.toThrow("Server is already running.");
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

    test("should serve health check endpoint on the configured port", async () => {
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

    test("should serve generated TypeweaverHono routers on the configured port", async () => {
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

    test("should serve with base path on the configured port", async () => {
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

      // Without prefix should 404
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

    test("should call onStopping hook with async handler", async () => {
      const getPort = (await import("get-port")).default;
      const port = await getPort();

      const cleanupDone = vi.fn();
      server = new TypeweaverServer({
        port,
        gracefulShutdown: false,
        hooks: {
          onStopping: async () => {
            // Simulate async cleanup
            await new Promise(resolve => setTimeout(resolve, 50));
            cleanupDone();
          },
        },
      });

      await server.start();
      await server.stop();

      expect(cleanupDone).toHaveBeenCalledOnce();
    });
  });
});
