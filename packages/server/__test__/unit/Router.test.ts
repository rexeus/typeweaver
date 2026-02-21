import { describe, expect, test } from "vitest";

import { Router } from "../../src/lib/Router";
import type { RouteDefinition, RouterErrorConfig } from "../../src/lib/Router";

const defaultConfig: RouterErrorConfig = {
  validateRequests: true,
  handleHttpResponseErrors: true,
  handleValidationErrors: true,
  handleUnknownErrors: true,
};

function createRoute(
  method: string,
  path: string,
  id?: string
): RouteDefinition {
  return {
    method,
    path,
    validator: {
      validate: (req: any) => req,
      safeValidate: (req: any) => ({ success: true, data: req }),
    },
    handler: async (req, _ctx) => ({
      statusCode: 200,
      body: { routeId: id ?? path },
    }),
    routerConfig: defaultConfig,
  };
}

describe("Router (Radix Tree)", () => {
  describe("Static Routes", () => {
    test("should match a simple static path", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      const match = router.match("GET", "/todos");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({});
    });

    test("should match a deeply nested static path", () => {
      const router = new Router();
      router.add(createRoute("GET", "/api/v1/accounts/settings"));

      const match = router.match("GET", "/api/v1/accounts/settings");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({});
    });

    test("should return undefined for non-matching static path", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      const match = router.match("GET", "/users");
      expect(match).toBeUndefined();
    });

    test("should return undefined for partial path match", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/list"));

      const match = router.match("GET", "/todos");
      expect(match).toBeUndefined();
    });

    test("should return undefined for longer path than registered", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      const match = router.match("GET", "/todos/extra");
      expect(match).toBeUndefined();
    });

    test("should differentiate between similar static paths", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos", "todos"));
      router.add(createRoute("GET", "/users", "users"));

      const todoMatch = router.match("GET", "/todos");
      expect(todoMatch).toBeDefined();

      const userMatch = router.match("GET", "/users");
      expect(userMatch).toBeDefined();
      expect(todoMatch!.route).not.toBe(userMatch!.route);
    });
  });

  describe("Parameterized Routes", () => {
    test("should match a single path parameter", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/:todoId"));

      const match = router.match("GET", "/todos/abc-123");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ todoId: "abc-123" });
    });

    test("should match multiple path parameters", () => {
      const router = new Router();
      router.add(
        createRoute("GET", "/todos/:todoId/subtodos/:subtodoId")
      );

      const match = router.match("GET", "/todos/t1/subtodos/st2");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ todoId: "t1", subtodoId: "st2" });
    });

    test("should match path parameter at the end", () => {
      const router = new Router();
      router.add(createRoute("DELETE", "/accounts/:accountId"));

      const match = router.match("DELETE", "/accounts/acc-42");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ accountId: "acc-42" });
    });

    test("should not match if segment count differs", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/:todoId"));

      expect(router.match("GET", "/todos")).toBeUndefined();
      expect(router.match("GET", "/todos/1/extra")).toBeUndefined();
    });
  });

  describe("Static vs Param Priority", () => {
    test("should prefer static segment over param segment", async () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/special", "static"));
      router.add(createRoute("GET", "/todos/:todoId", "param"));

      const match = router.match("GET", "/todos/special");
      expect(match).toBeDefined();

      // Static route should be preferred
      const response = await match!.route.handler(
        {} as any,
        { request: {} as any, state: new Map() }
      );
      expect(response).toEqual({
        statusCode: 200,
        body: { routeId: "static" },
      });
    });

    test("should fall back to param when static does not match", async () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/special", "static"));
      router.add(createRoute("GET", "/todos/:todoId", "param"));

      const match = router.match("GET", "/todos/other-value");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ todoId: "other-value" });

      const response = await match!.route.handler(
        {} as any,
        { request: {} as any, state: new Map() }
      );
      expect(response).toEqual({
        statusCode: 200,
        body: { routeId: "param" },
      });
    });
  });

  describe("HTTP Method Matching", () => {
    test("should match exact HTTP method", () => {
      const router = new Router();
      router.add(createRoute("POST", "/todos"));

      expect(router.match("POST", "/todos")).toBeDefined();
      expect(router.match("GET", "/todos")).toBeUndefined();
    });

    test("should be case-insensitive for methods", () => {
      const router = new Router();
      router.add(createRoute("get", "/todos"));

      const match = router.match("GET", "/todos");
      expect(match).toBeDefined();
    });

    test("should register multiple methods for the same path", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos", "get-todos"));
      router.add(createRoute("POST", "/todos", "post-todos"));

      const getMatch = router.match("GET", "/todos");
      const postMatch = router.match("POST", "/todos");

      expect(getMatch).toBeDefined();
      expect(postMatch).toBeDefined();
      expect(getMatch!.route).not.toBe(postMatch!.route);
    });

    test("should support all standard HTTP methods", () => {
      const methods = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "OPTIONS",
        "HEAD",
      ];
      const router = new Router();

      for (const method of methods) {
        router.add(createRoute(method, "/resource"));
      }

      for (const method of methods) {
        expect(router.match(method, "/resource")).toBeDefined();
      }
    });
  });

  describe("Edge Cases", () => {
    test("should handle root path", () => {
      const router = new Router();
      router.add(createRoute("GET", "/"));

      const match = router.match("GET", "/");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({});
    });

    test("should handle trailing slashes consistently", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      // Both with and without trailing slash should match
      // because toSegments filters empty strings
      const withSlash = router.match("GET", "/todos/");
      const withoutSlash = router.match("GET", "/todos");
      expect(withSlash).toBeDefined();
      expect(withoutSlash).toBeDefined();
    });

    test("should return undefined when no routes registered", () => {
      const router = new Router();
      expect(router.match("GET", "/anything")).toBeUndefined();
    });

    test("should handle many routes efficiently", () => {
      const router = new Router();

      // Register 200 routes
      for (let i = 0; i < 200; i++) {
        router.add(createRoute("GET", `/resource-${i}/items`));
      }

      // Add a parameterized route
      router.add(createRoute("GET", "/users/:userId/profile"));

      // All should still match correctly
      const match0 = router.match("GET", "/resource-0/items");
      expect(match0).toBeDefined();

      const match199 = router.match("GET", "/resource-199/items");
      expect(match199).toBeDefined();

      const matchParam = router.match("GET", "/users/u42/profile");
      expect(matchParam).toBeDefined();
      expect(matchParam!.params).toEqual({ userId: "u42" });

      const noMatch = router.match("GET", "/nonexistent");
      expect(noMatch).toBeUndefined();
    });
  });

  describe("matchesMiddlewarePath (static)", () => {
    test("should match everything when pattern is undefined", () => {
      expect(
        Router.matchesMiddlewarePath(undefined, "/any/path")
      ).toBe(true);
    });

    test("should match exact path", () => {
      expect(
        Router.matchesMiddlewarePath("/todos", "/todos")
      ).toBe(true);
    });

    test("should not match different path without wildcard", () => {
      expect(
        Router.matchesMiddlewarePath("/todos", "/users")
      ).toBe(false);
    });

    test("should match wildcard prefix", () => {
      expect(
        Router.matchesMiddlewarePath("/todos/*", "/todos/123")
      ).toBe(true);
    });

    test("should match deeply nested paths with wildcard", () => {
      expect(
        Router.matchesMiddlewarePath(
          "/todos/*",
          "/todos/123/subtodos/456"
        )
      ).toBe(true);
    });

    test("should match base path without trailing segment for wildcard", () => {
      expect(
        Router.matchesMiddlewarePath("/todos/*", "/todos")
      ).toBe(true);
    });

    test("should not match sibling paths with wildcard", () => {
      expect(
        Router.matchesMiddlewarePath("/todos/*", "/todosx/123")
      ).toBe(false);
    });
  });
});
