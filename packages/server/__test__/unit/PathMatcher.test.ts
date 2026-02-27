import { describe, expect, test } from "vitest";
import { pathMatcher } from "../../src/lib/PathMatcher";

describe("pathMatcher", () => {
  describe("exact match", () => {
    test("matches identical path", () => {
      const match = pathMatcher("/users");
      expect(match("/users")).toBe(true);
    });

    test("rejects different path", () => {
      const match = pathMatcher("/users");
      expect(match("/posts")).toBe(false);
    });

    test("rejects child path", () => {
      const match = pathMatcher("/users");
      expect(match("/users/123")).toBe(false);
    });

    test("rejects partial prefix overlap", () => {
      const match = pathMatcher("/users");
      expect(match("/users-admin")).toBe(false);
    });
  });

  describe("prefix match (/*)", () => {
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

    test("works with deeper prefix", () => {
      const match = pathMatcher("/api/v1/users/*");
      expect(match("/api/v1/users")).toBe(true);
      expect(match("/api/v1/users/123")).toBe(true);
      expect(match("/api/v1")).toBe(false);
    });
  });

  describe("parameterized segments (:param)", () => {
    test("matches single param segment", () => {
      const match = pathMatcher("/users/:id");
      expect(match("/users/123")).toBe(true);
    });

    test("rejects missing param segment", () => {
      const match = pathMatcher("/users/:id");
      expect(match("/users")).toBe(false);
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

    test("matches param with static prefix", () => {
      const match = pathMatcher("/api/v1/users/:id");
      expect(match("/api/v1/users/123")).toBe(true);
      expect(match("/api/v1/users")).toBe(false);
      expect(match("/api/v1/users/123/edit")).toBe(false);
    });
  });
});
