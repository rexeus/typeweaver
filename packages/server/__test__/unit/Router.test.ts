import type { HttpMethod } from "@rexeus/typeweaver-core";
import { assert, describe, expect, test } from "vitest";
import { Router } from "../../src/lib/Router.js";
import { noopResponseValidator, noopValidator } from "../helpers.js";
import type {
  RouteDefinition,
  RouterErrorConfig,
} from "../../src/lib/Router.js";

const defaultConfig: RouterErrorConfig = {
  validateRequests: true,
  validateResponses: true,
  handleHttpResponseErrors: true,
  handleRequestValidationErrors: true,
  handleResponseValidationErrors: true,
  handleUnknownErrors: true,
};

type RouteExpectation = {
  readonly operationId?: string;
  readonly path?: string;
  readonly method?: string;
  readonly params?: Record<string, string>;
};

const route = (
  method: string,
  path: string,
  operationId = `${method.toLowerCase()}${path.replace(/[/:]/g, "_")}`
): RouteDefinition => ({
  operationId,
  method: method.toUpperCase() as HttpMethod,
  path,
  requestValidator: noopValidator,
  responseValidator: noopResponseValidator,
  handler: async () => ({
    statusCode: 200,
    body: { routeId: operationId },
  }),
  routerConfig: defaultConfig,
});

const routeWithRegisteredMethod = (
  method: string,
  path: string,
  operationId?: string
): RouteDefinition => ({
  ...route(method, path, operationId),
  method: method as HttpMethod,
});

const expectMatch = (
  router: Router,
  method: string,
  path: string,
  expected: RouteExpectation = {}
) => {
  const match = router.match(method, path);
  assert(match, `Expected ${method} ${path} to match a route`);

  if (expected.operationId !== undefined) {
    expect(match.route.operationId).toBe(expected.operationId);
  }
  if (expected.path !== undefined) {
    expect(match.route.path).toBe(expected.path);
  }
  if (expected.method !== undefined) {
    expect(match.route.method).toBe(expected.method);
  }
  if (expected.params !== undefined) {
    expect(match.params).toEqual(expected.params);
  }

  return match;
};

const expectNoMatch = (router: Router, method: string, path: string) => {
  expect(router.match(method, path)).toBeUndefined();
};

describe("Router static routes", () => {
  test.each([
    {
      scenario: "simple path",
      registeredPath: "/todos",
      requestPath: "/todos",
      operationId: "list-todos",
    },
    {
      scenario: "deeply nested path",
      registeredPath: "/api/v1/accounts/settings",
      requestPath: "/api/v1/accounts/settings",
      operationId: "account-settings",
    },
  ])(
    "matches a registered $scenario",
    ({ registeredPath, requestPath, operationId }) => {
      const router = new Router();
      router.add(route("GET", registeredPath, operationId));

      expectMatch(router, "GET", requestPath, {
        operationId,
        method: "GET",
        path: registeredPath,
        params: {},
      });
    }
  );

  test.each([
    {
      scenario: "unregistered sibling path",
      registeredPath: "/todos",
      requestPath: "/users",
    },
    {
      scenario: "shorter partial path",
      registeredPath: "/todos/list",
      requestPath: "/todos",
    },
    {
      scenario: "longer child path",
      registeredPath: "/todos",
      requestPath: "/todos/extra",
    },
    {
      scenario: "partial prefix overlap",
      registeredPath: "/todos",
      requestPath: "/todos-admin",
    },
  ])(
    "rejects a $scenario for a static route",
    ({ registeredPath, requestPath }) => {
      const router = new Router();
      router.add(route("GET", registeredPath));

      expectNoMatch(router, "GET", requestPath);
    }
  );

  test("selects the intended route among similar static paths", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "todos"));
    router.add(route("GET", "/todo-settings", "todo-settings"));
    router.add(route("GET", "/users", "users"));

    expectMatch(router, "GET", "/todos", { operationId: "todos" });
    expectMatch(router, "GET", "/todo-settings", {
      operationId: "todo-settings",
    });
    expectMatch(router, "GET", "/users", { operationId: "users" });
  });
});

describe("Router parameterized routes", () => {
  test("extracts a single path parameter", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:todoId", "get-todo"));

    expectMatch(router, "GET", "/todos/abc-123", {
      operationId: "get-todo",
      params: { todoId: "abc-123" },
    });
  });

  test("extracts multiple path parameters", () => {
    const router = new Router();
    router.add(
      route("GET", "/todos/:todoId/subtodos/:subtodoId", "get-subtodo")
    );

    expectMatch(router, "GET", "/todos/t1/subtodos/st2", {
      operationId: "get-subtodo",
      params: { todoId: "t1", subtodoId: "st2" },
    });
  });

  test("extracts a parameter at the end of the path", () => {
    const router = new Router();
    router.add(route("DELETE", "/accounts/:accountId", "delete-account"));

    expectMatch(router, "DELETE", "/accounts/acc-42", {
      operationId: "delete-account",
      params: { accountId: "acc-42" },
    });
  });

  test("rejects requests with too few or too many parameter segments", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:todoId"));

    expectNoMatch(router, "GET", "/todos");
    expectNoMatch(router, "GET", "/todos/1/extra");
  });
});

describe("Router static and parameterized route priority", () => {
  test("selects a static route over a parameterized sibling", () => {
    const router = new Router();
    router.add(route("GET", "/todos/special", "static-todo"));
    router.add(route("GET", "/todos/:todoId", "param-todo"));

    expectMatch(router, "GET", "/todos/special", {
      operationId: "static-todo",
      path: "/todos/special",
      params: {},
    });
  });

  test("selects a parameterized route when a static sibling cannot complete", () => {
    const router = new Router();
    router.add(route("GET", "/items/special/info", "static-info"));
    router.add(route("GET", "/items/:itemId/details", "item-details"));

    expectMatch(router, "GET", "/items/special/details", {
      operationId: "item-details",
      path: "/items/:itemId/details",
      params: { itemId: "special" },
    });
  });

  test("returns only params from the selected route when an earlier candidate does not match", () => {
    const router = new Router();
    router.add(route("GET", "/items/static/:stale/never", "never"));
    router.add(route("GET", "/items/:itemId/details", "item-details"));

    expectMatch(router, "GET", "/items/static/details", {
      operationId: "item-details",
      params: { itemId: "static" },
    });
  });
});

describe("Router HTTP methods", () => {
  test("matches an exact HTTP method", () => {
    const router = new Router();
    router.add(route("POST", "/todos", "create-todo"));

    expectMatch(router, "POST", "/todos", {
      operationId: "create-todo",
      method: "POST",
    });
  });

  test("matches request methods case-insensitively", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "list-todos"));

    expectMatch(router, "get", "/todos", { operationId: "list-todos" });
    expectMatch(router, "GeT", "/todos", { operationId: "list-todos" });
  });

  test("matches lowercase method definitions case-insensitively", () => {
    const router = new Router();
    router.add(routeWithRegisteredMethod("get", "/todos", "list-todos"));

    expectMatch(router, "GET", "/todos", {
      operationId: "list-todos",
      method: "GET",
    });
  });

  test("selects the route registered for each method on the same path", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "list-todos"));
    router.add(route("POST", "/todos", "create-todo"));

    expectMatch(router, "GET", "/todos", { operationId: "list-todos" });
    expectMatch(router, "POST", "/todos", { operationId: "create-todo" });
  });

  test("selects the route registered for each method on the same parameterized path", () => {
    const router = new Router();
    router.add(route("GET", "/users/:userId", "get-user"));
    router.add(route("POST", "/users/:userId", "create-user"));

    expectMatch(router, "GET", "/users/u1", {
      operationId: "get-user",
      method: "GET",
      params: { userId: "u1" },
    });
    expectMatch(router, "POST", "/users/u1", {
      operationId: "create-user",
      method: "POST",
      params: { userId: "u1" },
    });
  });

  test.each(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])(
    "matches a registered %s route",
    method => {
      const router = new Router();
      router.add(route(method, "/resource", `${method}-resource`));

      expectMatch(router, method, "/resource", {
        operationId: `${method}-resource`,
        method,
      });
    }
  );
});

describe("Router HEAD fallback", () => {
  test("returns GET route metadata and params for HEAD when no explicit HEAD exists", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:todoId", "get-todo"));

    expectMatch(router, "HEAD", "/todos/t1", {
      operationId: "get-todo",
      method: "GET",
      path: "/todos/:todoId",
      params: { todoId: "t1" },
    });
  });

  test("selects an explicit HEAD route over the GET fallback", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "get-todos"));
    router.add(route("HEAD", "/todos", "head-todos"));

    expectMatch(router, "HEAD", "/todos", {
      operationId: "head-todos",
      method: "HEAD",
    });
  });

  test("selects an explicit lowercase HEAD route over the GET fallback", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "get-todos"));
    router.add(routeWithRegisteredMethod("head", "/todos", "head-todos"));

    expectMatch(router, "HEAD", "/todos", {
      operationId: "head-todos",
      method: "HEAD",
    });
  });

  test("rejects non-HEAD methods instead of falling back to GET", () => {
    const router = new Router();
    router.add(route("GET", "/todos"));

    expectNoMatch(router, "POST", "/todos");
    expectNoMatch(router, "DELETE", "/todos");
  });
});
