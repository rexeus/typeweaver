import { describe, expect, test } from "vitest";
import { StateMap } from "../../src/lib/StateMap.js";

describe("StateMap", () => {
  test("returns the value stored for a typed key", () => {
    const state = new StateMap<{ userId: string }>();

    state.set("userId", "u_42");

    expect(state.get("userId")).toBe("u_42");
  });

  test("returns undefined for keys that have not been set", () => {
    const state = new StateMap<{ userId: string }>();

    expect(state.get("userId")).toBeUndefined();
  });

  test("reports key absence before a key is stored", () => {
    const state = new StateMap<{ userId: string }>();

    expect(state.has("userId")).toBe(false);
  });

  test("reports key presence after a key is stored", () => {
    const state = new StateMap<{ userId: string }>();

    state.set("userId", "u_1");

    expect(state.has("userId")).toBe(true);
  });

  test("has distinguishes explicitly stored undefined from an unset key", () => {
    const state = new StateMap<{ userId: string | undefined }>();

    state.set("userId", undefined);

    expect(state.get("userId")).toBeUndefined();
    expect(state.has("userId")).toBe(true);
  });

  test("replaces an existing value for the same key", () => {
    const state = new StateMap<{ count: number }>();

    state.set("count", 1);
    state.set("count", 2);

    expect(state.get("count")).toBe(2);
  });

  test("stores multiple typed keys independently", () => {
    const state = new StateMap<{ userId: string; role: string }>();

    state.set("userId", "u_1");
    state.set("role", "admin");

    expect(state.get("userId")).toBe("u_1");
    expect(state.get("role")).toBe("admin");
  });

  test("allows arbitrary keys and values when no state shape is supplied", () => {
    const state = new StateMap();

    state.set("anything", 42);

    expect(state.get("anything")).toBe(42);
  });

  describe("merge", () => {
    test("sets each key supplied by a merge payload", () => {
      const state = new StateMap<{ userId: string; role: string }>();

      state.merge({ userId: "u_1", role: "admin" });

      expect(state.get("userId")).toBe("u_1");
      expect(state.get("role")).toBe("admin");
    });

    test("replaces existing values supplied by a merge payload", () => {
      const state = new StateMap<{ userId: string }>();

      state.set("userId", "old");
      state.merge({ userId: "new" });

      expect(state.get("userId")).toBe("new");
    });

    test("leaves existing state unchanged for an empty merge payload", () => {
      const state = new StateMap<{ userId: string }>();

      state.set("userId", "u_1");
      state.merge({});

      expect(state.get("userId")).toBe("u_1");
    });

    test("stores falsy values from a merge payload exactly", () => {
      const state = new StateMap<{
        count: number;
        enabled: boolean;
        label: string;
        metadata: null;
      }>();

      state.merge({ count: 0, enabled: false, label: "", metadata: null });

      expect(state.get("count")).toBe(0);
      expect(state.get("enabled")).toBe(false);
      expect(state.get("label")).toBe("");
      expect(state.get("metadata")).toBeNull();
    });

    test("stores own undefined values from a merge payload as present keys", () => {
      const state = new StateMap<{ userId: string | undefined }>();

      state.merge({ userId: undefined });

      expect(state.get("userId")).toBeUndefined();
      expect(state.has("userId")).toBe(true);
    });

    test("ignores inherited enumerable properties from a merge payload", () => {
      const state = new StateMap();
      const payload = Object.create({ role: "admin" }) as Record<
        string,
        unknown
      >;
      payload.userId = "u_1";

      state.merge(payload);

      expect(state.get("userId")).toBe("u_1");
      expect(state.has("role")).toBe(false);
    });

    test("ignores reserved keys that could mutate object prototypes", () => {
      const state = new StateMap();
      const payload = JSON.parse(
        '{"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad","userId":"u_1"}'
      ) as Record<string, unknown>;

      state.merge(payload);

      expect(state.get("userId")).toBe("u_1");
      expect(state.has("__proto__")).toBe(false);
      expect(state.has("constructor")).toBe(false);
      expect(state.has("prototype")).toBe(false);
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    });
  });
});
