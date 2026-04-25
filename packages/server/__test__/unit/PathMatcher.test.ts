import { describe, expect, test } from "vitest";
import { pathMatcher } from "../../src/lib/PathMatcher.js";

describe("pathMatcher", () => {
  describe("exact match", () => {
    test("matches the root path for a root pattern", () => {
      const match = pathMatcher("/");

      expect(match("/")).toBe(true);
    });

    test("matches duplicate-slash root paths for a root pattern", () => {
      const match = pathMatcher("/");

      expect(match("//")).toBe(true);
      expect(match("///")).toBe(true);
    });

    test("rejects child paths for a root pattern", () => {
      const match = pathMatcher("/");

      expect(match("/users")).toBe(false);
    });

    test("matches identical non-root paths", () => {
      const match = pathMatcher("/users");

      expect(match("/users")).toBe(true);
    });

    test("matches exact paths with trailing and duplicate slashes", () => {
      const match = pathMatcher("/users");

      expect(match("/users/")).toBe(true);
      expect(match("/users//")).toBe(true);
    });

    test("rejects unrooted paths for an exact rooted pattern", () => {
      const match = pathMatcher("/users");

      expect(match("users")).toBe(false);
    });

    test("rejects different non-root paths", () => {
      const match = pathMatcher("/users");

      expect(match("/posts")).toBe(false);
    });

    test("rejects child paths for an exact non-root pattern", () => {
      const match = pathMatcher("/users");

      expect(match("/users/123")).toBe(false);
    });

    test("rejects partial prefix overlap", () => {
      const match = pathMatcher("/users");

      expect(match("/users-admin")).toBe(false);
    });

    test("matches paths case-sensitively", () => {
      const match = pathMatcher("/users");

      expect(match("/Users")).toBe(false);
    });
  });

  describe("prefix match (/*)", () => {
    test("matches all rooted paths for a root wildcard pattern", () => {
      const match = pathMatcher("/*");

      expect(match("/")).toBe(true);
      expect(match("/users")).toBe(true);
    });

    test("matches exact prefix path", () => {
      const match = pathMatcher("/users/*");

      expect(match("/users")).toBe(true);
    });

    test("matches direct child", () => {
      const match = pathMatcher("/users/*");

      expect(match("/users/123")).toBe(true);
    });

    test("matches nested child", () => {
      const match = pathMatcher("/users/*");

      expect(match("/users/123/posts")).toBe(true);
    });

    test("rejects unrelated path", () => {
      const match = pathMatcher("/users/*");

      expect(match("/posts")).toBe(false);
    });

    test("rejects partial prefix overlap", () => {
      const match = pathMatcher("/users/*");

      expect(match("/users-admin")).toBe(false);
    });

    test("rejects unrooted paths for a prefixed wildcard pattern", () => {
      const match = pathMatcher("/users/*");

      expect(match("users/123")).toBe(false);
    });

    test.each([
      {
        scenario: "exact deeper prefix",
        path: "/api/v1/users",
        expected: true,
      },
      {
        scenario: "direct child of a deeper prefix",
        path: "/api/v1/users/123",
        expected: true,
      },
      {
        scenario: "parent of a deeper prefix",
        path: "/api/v1",
        expected: false,
      },
    ])("returns $expected for $scenario", ({ path, expected }) => {
      const match = pathMatcher("/api/v1/users/*");

      expect(match(path)).toBe(expected);
    });

    test("rejects unrooted paths for a root wildcard pattern", () => {
      const match = pathMatcher("/*");

      expect(match("users")).toBe(false);
    });

    test("rejects empty paths for a root wildcard pattern", () => {
      const match = pathMatcher("/*");

      expect(match("")).toBe(false);
    });

    test("matches prefix paths with trailing and duplicate slashes", () => {
      const match = pathMatcher("/users/*");

      expect(match("/users/")).toBe(true);
      expect(match("/users//123")).toBe(true);
      expect(match("/users/123/")).toBe(true);
    });
  });

  describe("parameterized segments (:param)", () => {
    test("matches single param segment", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/users/123")).toBe(true);
    });

    test("matches opaque non-empty parameter values", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/users/user-123_abc")).toBe(true);
    });

    test("rejects unrooted paths for a parameterized rooted pattern", () => {
      const match = pathMatcher("/users/:id");

      expect(match("users/123")).toBe(false);
    });

    test("matches parameter paths with trailing and duplicate slashes", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/users/123/")).toBe(true);
      expect(match("/users//123")).toBe(true);
    });

    test("rejects missing param segment", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/users")).toBe(false);
    });

    test("rejects an empty param segment from a trailing slash", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/users/")).toBe(false);
    });

    test("rejects extra segments after param", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/users/123/posts")).toBe(false);
    });

    test("rejects unrelated path", () => {
      const match = pathMatcher("/users/:id");

      expect(match("/posts/123")).toBe(false);
    });

    test("matches multiple param segments", () => {
      const match = pathMatcher("/todos/:todoId/subtodos/:subtodoId");

      expect(match("/todos/abc/subtodos/def")).toBe(true);
    });

    test("rejects multiple params with wrong static segment", () => {
      const match = pathMatcher("/todos/:todoId/subtodos/:subtodoId");

      expect(match("/todos/abc/items/def")).toBe(false);
    });

    test("rejects multiple params with missing segment", () => {
      const match = pathMatcher("/todos/:todoId/subtodos/:subtodoId");

      expect(match("/todos/abc/subtodos")).toBe(false);
    });

    test("rejects missing middle parameter after duplicate separators", () => {
      const match = pathMatcher("/users/:id/posts");

      expect(match("/users//posts")).toBe(false);
    });

    test.each([
      {
        scenario: "complete static prefix and parameter",
        path: "/api/v1/users/123",
        expected: true,
      },
      {
        scenario: "duplicate separators in a static prefix and parameter",
        path: "/api//v1/users//123/",
        expected: true,
      },
      {
        scenario: "static prefix without parameter",
        path: "/api/v1/users",
        expected: false,
      },
      {
        scenario: "extra segment after parameter",
        path: "/api/v1/users/123/edit",
        expected: false,
      },
    ])("returns $expected for $scenario", ({ path, expected }) => {
      const match = pathMatcher("/api/v1/users/:id");

      expect(match(path)).toBe(expected);
    });
  });
});
