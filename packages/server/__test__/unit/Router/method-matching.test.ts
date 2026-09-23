import { assert, describe, expect, test } from "vitest";
import { Router } from "../../../src/lib/Router.js";
import {
  expectMatch,
  expectNoMatch,
  route,
  routeWithRegisteredMethod,
} from "./fixtures.js";

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
