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

const expectAllowedMethods = (
  router: Router,
  path: string,
  expected: readonly string[]
) => {
  const match = router.matchPath(path);
  assert(match, `Expected ${path} to match a registered path`);
  expect(match.allowedMethods).toEqual(expected);
};

const expectNoAllowedMethods = (router: Router, path: string) => {
  expect(router.matchPath(path)).toBeUndefined();
};

describe("Router", () => {
  describe("static routes", () => {
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

  describe("parameterized routes", () => {
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

  describe("static and parameterized route priority", () => {
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

  describe("HTTP methods", () => {
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

  describe("HEAD fallback", () => {
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

  describe("matchPath", () => {
    test.each([
      {
        scenario: "GET and POST routes",
        methods: ["GET", "POST"],
        expected: ["GET", "HEAD", "POST"],
      },
      {
        scenario: "GET route",
        methods: ["GET"],
        expected: ["GET", "HEAD"],
      },
      {
        scenario: "POST route",
        methods: ["POST"],
        expected: ["POST"],
      },
      {
        scenario: "explicit HEAD route",
        methods: ["HEAD"],
        expected: ["HEAD"],
      },
      {
        scenario: "GET and explicit HEAD routes",
        methods: ["GET", "HEAD"],
        expected: ["GET", "HEAD"],
      },
    ])(
      "returns exact allowed method ordering for $scenario",
      ({ methods, expected }) => {
        const router = new Router();
        for (const method of methods) {
          router.add(route(method, "/todos", `${method}-todos`));
        }

        expectAllowedMethods(router, "/todos", expected);
      }
    );

    test("returns allowed methods for parameterized paths", () => {
      const router = new Router();
      router.add(route("PATCH", "/todos/:todoId", "update-todo"));

      expectAllowedMethods(router, "/todos/t1", ["PATCH"]);
    });

    test("returns allowed methods for canonicalized request paths", () => {
      const router = new Router();
      router.add(route("GET", "/todos/:todoId", "get-todo"));

      expectAllowedMethods(router, "/todos//t1/", ["GET", "HEAD"]);
    });

    test("returns normalized uppercase methods for mixed-case registrations", () => {
      const router = new Router();
      router.add(routeWithRegisteredMethod("get", "/todos", "list-todos"));
      router.add(
        routeWithRegisteredMethod("pOsT", "/todos", "create-todo")
      );

      expectAllowedMethods(router, "/todos", ["GET", "HEAD", "POST"]);
    });

    test("returns undefined when no registered path matches", () => {
      const router = new Router();
      router.add(route("GET", "/todos"));

      expectNoAllowedMethods(router, "/nonexistent");
    });
  });

  describe("URL decoding and dot segments", () => {
    test.each([
      {
        scenario: "space",
        requestPath: "/todos/hello%20world",
        expected: { todoId: "hello world" },
      },
      {
        scenario: "unicode",
        requestPath: "/todos/caf%C3%A9",
        expected: { todoId: "café" },
      },
    ])(
      "decodes a normal encoded $scenario in params",
      ({ requestPath, expected }) => {
        const router = new Router();
        router.add(route("GET", "/todos/:todoId", "get-todo"));

        expectMatch(router, "GET", requestPath, {
          operationId: "get-todo",
          params: expected,
        });
      }
    );

    test("keeps malformed encoded params as raw segments", () => {
      const router = new Router();
      router.add(route("GET", "/todos/:todoId", "get-todo"));

      expectMatch(router, "GET", "/todos/%ZZ", {
        operationId: "get-todo",
        params: { todoId: "%ZZ" },
      });
    });

    test("matches static segments without decoding them", () => {
      const router = new Router();
      router.add(route("GET", "/todos", "list-todos"));

      expectNoMatch(router, "GET", "/%74odos");
    });

    test.each([
      {
        scenario: "encoded parent segment",
        requestPath: "/files/%2e%2e",
        expected: { fileId: "%2e%2e" },
      },
      {
        scenario: "encoded current segment",
        requestPath: "/files/%2e",
        expected: { fileId: "%2e" },
      },
      {
        scenario: "double-encoded parent segment",
        requestPath: "/files/%252e%252e",
        expected: { fileId: "%2e%2e" },
      },
    ])(
      "keeps a $scenario from becoming a dot segment",
      ({ requestPath, expected }) => {
        const router = new Router();
        router.add(route("GET", "/files/:fileId", "get-file"));

        expectMatch(router, "GET", requestPath, {
          operationId: "get-file",
          params: expected,
        });
      }
    );

    test.each([
      {
        scenario: "forward slash",
        requestPath: "/files/folder%2Ffile",
        expected: { fileId: "folder%2Ffile" },
      },
      {
        scenario: "backslash",
        requestPath: "/files/folder%5Cfile",
        expected: { fileId: "folder%5Cfile" },
      },
    ])(
      "keeps a non-traversal encoded $scenario separator as a raw param segment",
      ({ requestPath, expected }) => {
        const router = new Router();
        router.add(route("GET", "/files/:fileId", "get-file"));

        expectMatch(router, "GET", requestPath, {
          operationId: "get-file",
          params: expected,
        });
      }
    );

    test.each([
      {
        scenario: "forward slash traversal payload",
        requestPath: "/files/%2e%2e%2fsecret",
        expected: { fileId: "%2e%2e%2fsecret" },
      },
      {
        scenario: "backslash traversal payload",
        requestPath: "/files/%2e%2e%5csecret",
        expected: { fileId: "%2e%2e%5csecret" },
      },
    ])(
      "keeps an encoded $scenario as a raw param segment",
      ({ requestPath, expected }) => {
        const router = new Router();
        router.add(route("GET", "/files/:fileId", "get-file"));

        expectMatch(router, "GET", requestPath, {
          operationId: "get-file",
          params: expected,
        });
      }
    );
  });

  describe("path canonicalization", () => {
    test("matches the root route for root-like request paths", () => {
      const router = new Router();
      router.add(route("GET", "/", "root"));

      expectMatch(router, "GET", "/", { operationId: "root", params: {} });
      expectMatch(router, "GET", "//", { operationId: "root", params: {} });
    });

    test("rejects child paths for the root route", () => {
      const router = new Router();
      router.add(route("GET", "/", "root"));

      expectNoMatch(router, "GET", "/todos");
    });

    test("matches trailing-slash requests for routes registered without one", () => {
      const router = new Router();
      router.add(route("GET", "/todos", "list-todos"));

      expectMatch(router, "GET", "/todos/", {
        operationId: "list-todos",
        params: {},
      });
    });

    test("matches non-trailing requests for routes registered with trailing slashes", () => {
      const router = new Router();
      router.add(route("GET", "/todos/", "list-todos"));

      expectMatch(router, "GET", "/todos", {
        operationId: "list-todos",
        path: "/todos/",
        params: {},
      });
    });

    test("matches duplicate slashes in registered and requested paths", () => {
      const router = new Router();
      router.add(route("GET", "//api//todos//:todoId//", "get-todo"));

      expectMatch(router, "GET", "/api/todos//t1/", {
        operationId: "get-todo",
        params: { todoId: "t1" },
      });
    });

    test("matches empty paths as the root route", () => {
      const router = new Router();
      router.add(route("GET", "/", "root"));

      expectMatch(router, "GET", "", { operationId: "root", params: {} });
    });

    test("matches unrooted request paths as rooted equivalents", () => {
      const router = new Router();
      router.add(route("GET", "/todos/:todoId", "get-todo"));

      expectMatch(router, "GET", "todos/t1", {
        operationId: "get-todo",
        params: { todoId: "t1" },
      });
    });

    test("registers unrooted paths as rooted equivalents", () => {
      const router = new Router();
      router.add(route("GET", "todos/:todoId", "get-todo"));

      expectMatch(router, "GET", "/todos/t1", {
        operationId: "get-todo",
        path: "todos/:todoId",
        params: { todoId: "t1" },
      });
    });

    test("returns undefined when no routes are registered", () => {
      const router = new Router();

      expectNoMatch(router, "GET", "/anything");
    });
  });

  describe("large route tables", () => {
    test("continues selecting exact static and parameterized routes after many registrations", () => {
      const router = new Router();

      for (let i = 0; i < 200; i++) {
        router.add(route("GET", `/resource-${i}/items`, `resource-${i}`));
      }
      router.add(route("GET", "/users/:userId/profile", "user-profile"));

      expectMatch(router, "GET", "/resource-0/items", {
        operationId: "resource-0",
      });
      expectMatch(router, "GET", "/resource-199/items", {
        operationId: "resource-199",
      });
      expectMatch(router, "GET", "/users/u42/profile", {
        operationId: "user-profile",
        params: { userId: "u42" },
      });
      expectNoMatch(router, "GET", "/nonexistent");
    });
  });

  describe("route conflict detection", () => {
    test("rejects duplicate method and path registrations", () => {
      const router = new Router();
      router.add(route("GET", "/todos"));

      expect(() => router.add(route("GET", "/todos"))).toThrow(
        /Route conflict: GET \/todos is already registered/
      );
    });

    test("rejects duplicate routes whose method differs only by case", () => {
      const router = new Router();
      router.add(route("GET", "/todos"));

      expect(() =>
        router.add(routeWithRegisteredMethod("get", "/todos"))
      ).toThrow(/Route conflict: GET \/todos is already registered/);
    });

    test("rejects duplicate parameterized routes", () => {
      const router = new Router();
      router.add(route("GET", "/todos/:todoId"));

      expect(() => router.add(route("GET", "/todos/:todoId"))).toThrow(
        /Route conflict: GET \/todos\/:todoId is already registered/
      );
    });

    test.each([
      {
        scenario: "duplicate-slash",
        registeredPath: "/todos/",
        duplicatePath: "//todos",
      },
      {
        scenario: "unrooted",
        registeredPath: "/todos/",
        duplicatePath: "todos",
      },
    ])(
      "rejects duplicate $scenario paths after canonicalization",
      ({ registeredPath, duplicatePath }) => {
        const router = new Router();
        router.add(route("GET", registeredPath));

        expect(() => router.add(route("GET", duplicatePath))).toThrow(
          /Route conflict: GET .* is already registered/
        );
      }
    );

    test("allows different methods on the same path", () => {
      const router = new Router();
      router.add(route("GET", "/todos"));

      expect(() => router.add(route("POST", "/todos"))).not.toThrow();
    });

    test("allows extending a parameterized route with the same parameter name", () => {
      const router = new Router();
      router.add(route("GET", "/users/:userId", "get-user"));

      expect(() =>
        router.add(route("GET", "/users/:userId/profile", "get-profile"))
      ).not.toThrow();
      expectMatch(router, "GET", "/users/u1/profile", {
        operationId: "get-profile",
        params: { userId: "u1" },
      });
    });

    test("rejects routes that rename an existing parameter segment", () => {
      const router = new Router();
      router.add(route("GET", "/users/:userId"));

      expect(() => router.add(route("GET", "/users/:id/profile"))).toThrow(
        /Conflicting path parameter names.*":userId" vs ":id"/
      );
    });

    test("rejects parameter renames across HTTP methods", () => {
      const router = new Router();
      router.add(route("GET", "/users/:userId"));

      expect(() => router.add(route("POST", "/users/:id"))).toThrow(
        /Conflicting path parameter names.*":userId" vs ":id"/
      );
    });
  });
});
