import { describe, test } from "vitest";
import { Router } from "../../../src/lib/Router.js";
import { expectMatch, expectNoMatch, route } from "./fixtures.js";

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
