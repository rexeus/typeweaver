import { describe, expect, test } from "vitest";
import { StateMap } from "../../src/lib/StateMap";

describe("StateMap", () => {
  test("should set and get a value", () => {
    const state = new StateMap<{ userId: string }>();
    state.set("userId", "u_42");
    expect(state.get("userId")).toBe("u_42");
  });

  test("should return undefined for unset keys", () => {
    const state = new StateMap<{ userId: string }>();
    expect(state.get("userId")).toBeUndefined();
  });

  test("should report has() correctly", () => {
    const state = new StateMap<{ userId: string }>();
    expect(state.has("userId")).toBe(false);
    state.set("userId", "u_1");
    expect(state.has("userId")).toBe(true);
  });

  test("should overwrite existing values", () => {
    const state = new StateMap<{ count: number }>();
    state.set("count", 1);
    state.set("count", 2);
    expect(state.get("count")).toBe(2);
  });

  test("should support multiple keys", () => {
    const state = new StateMap<{ userId: string; role: string }>();
    state.set("userId", "u_1");
    state.set("role", "admin");
    expect(state.get("userId")).toBe("u_1");
    expect(state.get("role")).toBe("admin");
  });

  test("should work with default generic (untyped)", () => {
    const state = new StateMap();
    state.set("anything", 42);
    expect(state.get("anything")).toBe(42);
  });

  describe("merge", () => {
    test("should merge multiple keys at once", () => {
      const state = new StateMap<{ userId: string; role: string }>();
      state.merge({ userId: "u_1", role: "admin" });
      expect(state.get("userId")).toBe("u_1");
      expect(state.get("role")).toBe("admin");
    });

    test("should overwrite existing values on merge", () => {
      const state = new StateMap<{ userId: string }>();
      state.set("userId", "old");
      state.merge({ userId: "new" });
      expect(state.get("userId")).toBe("new");
    });

    test("should handle empty merge object", () => {
      const state = new StateMap<{ userId: string }>();
      state.set("userId", "u_1");
      state.merge({});
      expect(state.get("userId")).toBe("u_1");
    });

    test("should skip __proto__, constructor, and prototype keys", () => {
      const state = new StateMap();
      state.merge({ __proto__: { evil: true }, constructor: "bad", prototype: "bad", userId: "u_1" });
      expect(state.get("userId")).toBe("u_1");
      expect(state.has("__proto__" as any)).toBe(false);
      expect(state.has("constructor" as any)).toBe(false);
      expect(state.has("prototype" as any)).toBe(false);
    });
  });
});
