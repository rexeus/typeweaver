import { HttpMethod } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { compareRoutes, getMethodPriority } from "../src/helpers/routeSort.js";

type Route = {
  readonly method: string;
  readonly path: string;
};

const expectRouteToSortBefore = (earlier: Route, later: Route): void => {
  expect(compareRoutes(earlier, later)).toBeLessThan(0);
};

describe("getMethodPriority", () => {
  test.each([
    { method: HttpMethod.GET, expected: 1 },
    { method: HttpMethod.POST, expected: 2 },
    { method: HttpMethod.PUT, expected: 3 },
    { method: HttpMethod.PATCH, expected: 4 },
    { method: HttpMethod.DELETE, expected: 5 },
    { method: HttpMethod.OPTIONS, expected: 6 },
    { method: HttpMethod.HEAD, expected: 7 },
  ])("assigns priority $expected to $method routes", ({ method, expected }) => {
    expect(getMethodPriority(method)).toBe(expected);
  });

  test("falls back to the default priority for unknown methods", () => {
    expect(getMethodPriority("TRACE")).toBe(999);
  });
});

describe("compareRoutes", () => {
  test("orders a mixed route list by depth, path specificity, and method priority", () => {
    const routes = [
      { label: "get user detail", method: HttpMethod.GET, path: "/users/:id" },
      { label: "create user", method: HttpMethod.POST, path: "/users" },
      {
        label: "get user settings",
        method: HttpMethod.GET,
        path: "/users/settings",
      },
      { label: "list users", method: HttpMethod.GET, path: "/users" },
      { label: "root", method: HttpMethod.GET, path: "/" },
    ];

    const orderedRoutes = [...routes].sort(compareRoutes).map(route => ({
      label: route.label,
      method: route.method,
      path: route.path,
    }));

    expect(orderedRoutes).toEqual([
      { label: "root", method: HttpMethod.GET, path: "/" },
      { label: "list users", method: HttpMethod.GET, path: "/users" },
      { label: "create user", method: HttpMethod.POST, path: "/users" },
      {
        label: "get user settings",
        method: HttpMethod.GET,
        path: "/users/settings",
      },
      { label: "get user detail", method: HttpMethod.GET, path: "/users/:id" },
    ]);
  });

  test("sorts the root route before non-root routes", () => {
    expectRouteToSortBefore(
      { method: HttpMethod.GET, path: "/" },
      { method: HttpMethod.GET, path: "/users" }
    );
  });

  test("sorts shallower routes before deeper routes", () => {
    expectRouteToSortBefore(
      { method: HttpMethod.GET, path: "/users" },
      { method: HttpMethod.GET, path: "/users/:id" }
    );
  });

  test("sorts static segments before parameter segments", () => {
    expectRouteToSortBefore(
      { method: HttpMethod.GET, path: "/users/list" },
      { method: HttpMethod.GET, path: "/users/:id" }
    );
  });

  test.each([
    {
      scenario: "first static segment",
      earlier: { method: HttpMethod.GET, path: "/accounts" },
      later: { method: HttpMethod.GET, path: "/users" },
    },
    {
      scenario: "later static segment after shared ancestors",
      earlier: { method: HttpMethod.GET, path: "/api/v1/accounts" },
      later: { method: HttpMethod.GET, path: "/api/v1/users" },
    },
  ])("sorts $scenario alphabetically", ({ earlier, later }) => {
    expectRouteToSortBefore(earlier, later);
  });

  test.each([
    {
      scenario: "single parameter segment",
      earlier: { method: HttpMethod.GET, path: "/users/:accountId" },
      later: { method: HttpMethod.GET, path: "/users/:userId" },
    },
    {
      scenario: "later parameter segment after shared ancestors",
      earlier: { method: HttpMethod.GET, path: "/teams/:teamId/:memberId" },
      later: { method: HttpMethod.GET, path: "/teams/:teamId/:userId" },
    },
  ])("sorts $scenario alphabetically", ({ earlier, later }) => {
    expectRouteToSortBefore(earlier, later);
  });

  test("uses method priority when paths are otherwise identical", () => {
    expectRouteToSortBefore(
      { method: HttpMethod.GET, path: "/users" },
      { method: HttpMethod.POST, path: "/users" }
    );
  });

  test("treats unknown methods as the lowest priority", () => {
    expectRouteToSortBefore(
      { method: HttpMethod.HEAD, path: "/users" },
      { method: "TRACE", path: "/users" }
    );
  });

  test("treats equal paths with equal methods as the same route order", () => {
    const result = compareRoutes(
      { method: HttpMethod.GET, path: "/users" },
      { method: HttpMethod.GET, path: "/users" }
    );

    expect(result).toBe(0);
  });

  test("treats duplicate and trailing separators as equivalent route order", () => {
    const canonical = { method: HttpMethod.GET, path: "/users/settings" };
    const duplicated = { method: HttpMethod.GET, path: "/users//settings/" };

    expect(compareRoutes(canonical, duplicated)).toBe(0);
    expect(compareRoutes(duplicated, canonical)).toBe(0);
  });

  test("treats unknown methods with identical paths as the same route order", () => {
    const result = compareRoutes(
      { method: "TRACE", path: "/users" },
      { method: "CONNECT", path: "/users" }
    );

    expect(result).toBe(0);
  });
});
