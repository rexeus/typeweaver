import { describe, expect, test } from "vitest";
import { createPluginRegistry } from "../src/plugins/pluginRegistry";
import { PluginDependencyError } from "../src/plugins/types";

const createPlugin = (name: string, depends?: readonly string[]) => ({
  name,
  depends,
});

describe("createPluginRegistry", () => {
  test("sorts plugins topologically before returning registrations", () => {
    const registry = createPluginRegistry();

    registry.register(createPlugin("clients", ["types"]));
    registry.register(createPlugin("types"));
    registry.register(createPlugin("analytics", ["clients"]));

    expect(registry.getAll().map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "analytics",
    ]);
  });

  test("returns a defensive copy while reusing the cached order", () => {
    const registry = createPluginRegistry();

    registry.register(createPlugin("clients", ["types"]));
    registry.register(createPlugin("types"));

    const firstResult = registry.getAll();
    const secondResult = registry.getAll();

    expect(secondResult).not.toBe(firstResult);
    expect(secondResult).toEqual(firstResult);

    firstResult.reverse();

    expect(registry.getAll().map(registration => registration.name)).toEqual([
      "types",
      "clients",
    ]);

    registry.register(createPlugin("analytics", ["clients"]));

    const thirdResult = registry.getAll();

    expect(thirdResult).not.toBe(firstResult);
    expect(thirdResult.map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "analytics",
    ]);

    registry.clear();

    expect(registry.getAll()).toEqual([]);
  });

  test("throws when a dependency is missing", () => {
    const registry = createPluginRegistry();
    registry.register(createPlugin("clients", ["types"]));

    expect(() => registry.getAll()).toThrowError(
      new PluginDependencyError("clients", "types")
    );
  });

  test("throws when dependencies contain a cycle", () => {
    const registry = createPluginRegistry();

    registry.register(createPlugin("types", ["clients"]));
    registry.register(createPlugin("clients", ["types"]));

    expect(() => registry.getAll()).toThrowError(
      new PluginDependencyError(
        "types",
        "types",
        "Detected plugin dependency cycle: types -> clients -> types"
      )
    );
  });
});
