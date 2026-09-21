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

describe("Router matchPath", () => {
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
    router.add(routeWithRegisteredMethod("pOsT", "/todos", "create-todo"));

    expectAllowedMethods(router, "/todos", ["GET", "HEAD", "POST"]);
  });

  test("returns undefined when no registered path matches", () => {
    const router = new Router();
    router.add(route("GET", "/todos"));

    expectNoAllowedMethods(router, "/nonexistent");
  });
});

describe("Router URL decoding", () => {
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
});

describe("Router encoded separators and traversal segments", () => {
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

describe("Router path canonicalization", () => {
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

describe("Router large route tables", () => {
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
