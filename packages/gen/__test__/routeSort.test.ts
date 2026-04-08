import { HttpMethod } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { compareRoutes, getMethodPriority } from "../src/helpers/routeSort.js";

describe("getMethodPriority", () => {
  test("returns the configured priority for known methods", () => {
    expect(getMethodPriority(HttpMethod.GET)).toBe(1);
    expect(getMethodPriority(HttpMethod.POST)).toBe(2);
    expect(getMethodPriority(HttpMethod.PUT)).toBe(3);
    expect(getMethodPriority(HttpMethod.PATCH)).toBe(4);
    expect(getMethodPriority(HttpMethod.DELETE)).toBe(5);
    expect(getMethodPriority(HttpMethod.OPTIONS)).toBe(6);
    expect(getMethodPriority(HttpMethod.HEAD)).toBe(7);
  });

  test("falls back to the default priority for unknown methods", () => {
    expect(getMethodPriority("TRACE")).toBe(999);
  });
});

describe("compareRoutes", () => {
  test("sorts shallower routes before deeper routes", () => {
    expect(
      compareRoutes(
        { method: HttpMethod.GET, path: "/users" },
        { method: HttpMethod.GET, path: "/users/:id" }
      )
    ).toBeLessThan(0);
  });

  test("sorts static segments before parameter segments", () => {
    expect(
      compareRoutes(
        { method: HttpMethod.GET, path: "/users/list" },
        { method: HttpMethod.GET, path: "/users/:id" }
      )
    ).toBeLessThan(0);
  });

  test("sorts alphabetically within the same segment type", () => {
    expect(
      compareRoutes(
        { method: HttpMethod.GET, path: "/accounts" },
        { method: HttpMethod.GET, path: "/users" }
      )
    ).toBeLessThan(0);
    expect(
      compareRoutes(
        { method: HttpMethod.GET, path: "/users/:accountId" },
        { method: HttpMethod.GET, path: "/users/:userId" }
      )
    ).toBeLessThan(0);
  });

  test("uses method priority when paths are otherwise identical", () => {
    expect(
      compareRoutes(
        { method: HttpMethod.GET, path: "/users" },
        { method: HttpMethod.POST, path: "/users" }
      )
    ).toBeLessThan(0);
  });

  test("treats unknown methods as the lowest priority", () => {
    expect(
      compareRoutes(
        { method: HttpMethod.HEAD, path: "/users" },
        { method: "TRACE", path: "/users" }
      )
    ).toBeLessThan(0);
  });
});
