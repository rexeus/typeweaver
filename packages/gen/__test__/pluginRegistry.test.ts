import { describe, expect, test } from "vitest";
import { createPluginRegistry } from "../src/plugins/pluginRegistry.js";
import { PluginDependencyError } from "../src/plugins/types.js";
import type { TypeweaverPlugin } from "../src/plugins/types.js";

const aPluginNamed = (
  name: string,
  depends?: readonly string[]
): TypeweaverPlugin => ({
  name,
  depends,
});

describe("createPluginRegistry", () => {
  test("get returns undefined for unknown plugins before and after registrations", () => {
    const registry = createPluginRegistry();

    expect(registry.get("missing")).toBeUndefined();

    registry.register(aPluginNamed("types"));

    expect(registry.get("missing")).toBeUndefined();
  });

  test("has returns false for unknown plugins in a populated registry", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("types"));

    expect(registry.has("clients")).toBe(false);
  });

  test("stores registered plugins and config by plugin name", () => {
    const registry = createPluginRegistry();
    const typesPlugin = aPluginNamed("types");

    registry.register(typesPlugin, { emitDeclarations: true });

    expect(registry.get("types")).toMatchObject({
      name: "types",
      plugin: typesPlugin,
      config: { emitDeclarations: true },
    });
    expect(registry.has("types")).toBe(true);
  });

  test("returns independent plugins in registration order", () => {
    const registry = createPluginRegistry();
    const typesPlugin = aPluginNamed("types");
    const clientsPlugin = aPluginNamed("clients");

    registry.register(typesPlugin);
    registry.register(clientsPlugin);

    const registrations = registry.getAll();

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
    ]);
  });

  test("orders plugin dependencies before their dependents", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("clients", ["types"]));
    registry.register(aPluginNamed("analytics", ["clients", "hono"]));
    registry.register(aPluginNamed("types"));
    registry.register(aPluginNamed("hono", ["types"]));

    const registrations = registry.getAll();

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "hono",
      "analytics",
    ]);
  });

  test("reports the plugin and dependency names when a dependency is missing", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("clients", ["types"]));

    const readRegistrations = () => registry.getAll();

    expect(readRegistrations).toThrowError(PluginDependencyError);
    expect(readRegistrations).toThrowError(
      "Plugin 'clients' depends on 'types' which is not loaded"
    );
  });

  test("reports the dependency path when plugin dependencies contain a cycle", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("types", ["clients"]));
    registry.register(aPluginNamed("clients", ["analytics"]));
    registry.register(aPluginNamed("analytics", ["types"]));

    const readRegistrations = () => registry.getAll();

    expect(readRegistrations).toThrowError(PluginDependencyError);
    expect(readRegistrations).toThrowError(
      "Detected plugin dependency cycle: types -> clients -> analytics -> types"
    );
  });

  test("reports a self-dependency as a dependency cycle", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("types", ["types"]));

    const readRegistrations = () => registry.getAll();

    expect(readRegistrations).toThrowError(PluginDependencyError);
    expect(readRegistrations).toThrowError(
      "Detected plugin dependency cycle: types -> types"
    );
  });

  test("does not duplicate sorted registrations for duplicate dependency names", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("clients", ["types", "types"]));
    registry.register(aPluginNamed("types"));

    const registrations = registry.getAll();

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
    ]);
  });

  test("returns a fresh ordered array for each read", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("clients", ["types"]));
    registry.register(aPluginNamed("types"));

    const firstRead = registry.getAll();
    const secondRead = registry.getAll();

    expect(secondRead).not.toBe(firstRead);
    expect(secondRead).toEqual(firstRead);

    firstRead.reverse();

    expect(registry.getAll().map(registration => registration.name)).toEqual([
      "types",
      "clients",
    ]);
  });

  test("reflects plugins registered after an earlier read", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("clients", ["types"]));
    registry.register(aPluginNamed("types"));
    registry.getAll();

    registry.register(aPluginNamed("analytics", ["clients"]));

    const registrations = registry.getAll();

    expect(registrations.map(registration => registration.name)).toEqual([
      "types",
      "clients",
      "analytics",
    ]);
  });

  test("invalidates a successful read when a later registration has a missing dependency", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("types"));
    expect(registry.getAll().map(registration => registration.name)).toEqual([
      "types",
    ]);

    registry.register(aPluginNamed("clients", ["hono"]));

    const readRegistrations = () => registry.getAll();
    expect(readRegistrations).toThrowError(
      "Plugin 'clients' depends on 'hono' which is not loaded"
    );
  });

  test("clear removes registrations and previous ordering", () => {
    const registry = createPluginRegistry();

    registry.register(aPluginNamed("clients", ["types"]));
    registry.register(aPluginNamed("types"));
    registry.getAll();

    registry.clear();
    registry.register(aPluginNamed("analytics"));

    expect(registry.get("types")).toBeUndefined();
    expect(registry.has("clients")).toBe(false);
    expect(registry.getAll().map(registration => registration.name)).toEqual([
      "analytics",
    ]);
  });

  describe("characterization: duplicate plugin names", () => {
    test("keeps the first registration when a duplicate name is registered (characterization)", () => {
      const registry = createPluginRegistry();
      const originalPlugin = aPluginNamed("types");
      const duplicatePlugin = aPluginNamed("types", ["clients"]);

      registry.register(originalPlugin, { source: "original" });
      registry.register(duplicatePlugin, { source: "duplicate" });

      const registrations = registry.getAll();

      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toMatchObject({
        name: "types",
        plugin: originalPlugin,
        config: { source: "original" },
      });
    });
  });
});
