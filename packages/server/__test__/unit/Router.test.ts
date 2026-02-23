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

  describe("HEAD Fallback", () => {
    test("should match HEAD request using GET handler when no explicit HEAD handler", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos", "get-handler"));

      const match = router.match("HEAD", "/todos");
      expect(match).toBeDefined();
    });

    test("should prefer explicit HEAD handler over GET fallback", async () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos", "get-handler"));
      router.add(createRoute("HEAD", "/todos", "head-handler"));

      const match = router.match("HEAD", "/todos");
      expect(match).toBeDefined();
      const response = await match!.route.handler(
        {} as any,
        { request: {} as any, state: new Map() }
      );
      expect(response.body.routeId).toBe("head-handler");
    });

    test("should not fall back to GET for non-HEAD methods", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      expect(router.match("POST", "/todos")).toBeUndefined();
      expect(router.match("DELETE", "/todos")).toBeUndefined();
    });

    test("should fall back HEAD to GET on parameterized routes", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/:todoId"));

      const match = router.match("HEAD", "/todos/t1");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ todoId: "t1" });
    });
  });

  describe("matchPath (405 support)", () => {
    test("should find node when path exists", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));
      router.add(createRoute("POST", "/todos"));

      const pathMatch = router.matchPath("/todos");
      expect(pathMatch).toBeDefined();
      expect(pathMatch!.node.methods.size).toBe(2);
    });

    test("should return undefined when path does not exist", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      const pathMatch = router.matchPath("/nonexistent");
      expect(pathMatch).toBeUndefined();
    });

    test("should extract params for parameterized paths", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/:todoId"));

      const pathMatch = router.matchPath("/todos/t1");
      expect(pathMatch).toBeDefined();
      expect(pathMatch!.params).toEqual({ todoId: "t1" });
    });
  });

  describe("getAllowedMethods", () => {
    test("should return registered methods sorted", () => {
      const router = new Router();
      router.add(createRoute("POST", "/todos"));
      router.add(createRoute("GET", "/todos"));

      const pathMatch = router.matchPath("/todos");
      const allowed = Router.getAllowedMethods(pathMatch!.node);
      expect(allowed).toEqual(["GET", "HEAD", "POST"]);
    });

    test("should implicitly include HEAD when GET is registered", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      const pathMatch = router.matchPath("/todos");
      const allowed = Router.getAllowedMethods(pathMatch!.node);
      expect(allowed).toContain("HEAD");
    });

    test("should not duplicate HEAD if explicitly registered", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));
      router.add(createRoute("HEAD", "/todos"));

      const pathMatch = router.matchPath("/todos");
      const allowed = Router.getAllowedMethods(pathMatch!.node);
      const headCount = allowed.filter(m => m === "HEAD").length;
      expect(headCount).toBe(1);
    });
  });

  describe("URL Decoding", () => {
    test("should decode URL-encoded path parameters", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/:todoId"));

      const match = router.match("GET", "/todos/hello%20world");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ todoId: "hello world" });
    });

    test("should decode special characters in path parameters", () => {
      const router = new Router();
      router.add(createRoute("GET", "/users/:name"));

      const match = router.match("GET", "/users/caf%C3%A9");
      expect(match).toBeDefined();
      expect(match!.params).toEqual({ name: "café" });
    });

    test("should handle malformed encoding gracefully", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos/:todoId"));

      // %ZZ is not valid percent-encoding
      const match = router.match("GET", "/todos/%ZZ");
      expect(match).toBeDefined();
      // Should return the raw segment when decoding fails
      expect(match!.params).toEqual({ todoId: "%ZZ" });
    });

    test("should not decode static segments during matching", () => {
      const router = new Router();
      router.add(createRoute("GET", "/todos"));

      // %74odos = "todos" when decoded, but static matching is exact
      const match = router.match("GET", "/%74odos");
      expect(match).toBeUndefined();
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
