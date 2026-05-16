import { Effect, Either, Layer, ManagedRuntime } from "effect";
import { describe, expect, test } from "vitest";
import {
  PluginModuleLoader,
  PluginModuleNotFoundError,
} from "../../src/services/PluginModuleLoader.js";

/**
 * Builds a `PluginModuleLoader` layer backed by an in-memory map of
 * specifier → module record. Tests prefer this over writing real `.mjs`
 * fixtures to disk because module resolution behavior is irrelevant when
 * the goal is to exercise the consumer's branching.
 */
const inMemoryPluginModuleLoader = (
  modules: ReadonlyMap<string, Record<string, unknown>>
): Layer.Layer<PluginModuleLoader> =>
  Layer.succeed(PluginModuleLoader, {
    load: specifier => {
      const moduleRecord = modules.get(specifier);
      if (moduleRecord === undefined) {
        return Effect.fail(
          new PluginModuleNotFoundError({
            specifier,
            cause: new Error("Specifier not in in-memory map"),
          })
        );
      }
      return Effect.succeed(moduleRecord);
    },
  } as PluginModuleLoader["Type"]);

const aNamedPluginModule = (): Record<string, unknown> => ({
  namedPlugin: { name: "named-plugin" },
});

const runWithModules = async (
  modules: ReadonlyMap<string, Record<string, unknown>>,
  effect: Effect.Effect<unknown, unknown, PluginModuleLoader>
): Promise<unknown> => {
  const runtime = ManagedRuntime.make(inMemoryPluginModuleLoader(modules));
  try {
    return await runtime.runPromise(effect);
  } finally {
    await runtime.dispose();
  }
};

describe("PluginModuleLoader", () => {
  test("resolves an in-memory specifier to its module record", async () => {
    const namedPlugin = aNamedPluginModule();
    const modules = new Map([["my-plugin", namedPlugin]]);

    const result = await runWithModules(
      modules,
      PluginModuleLoader.load("my-plugin")
    );

    expect(result).toBe(namedPlugin);
  });

  test("fails with PluginModuleNotFoundError when the specifier is unknown", async () => {
    const result = await runWithModules(
      new Map(),
      Effect.either(PluginModuleLoader.load("missing"))
    );

    if (!Either.isLeft(result)) {
      throw new Error("Expected loader to fail for an unknown specifier");
    }

    expect(result.left).toBeInstanceOf(PluginModuleNotFoundError);
    expect(result.left.specifier).toBe("missing");
  });

  test("PluginModuleNotFoundError carries the original cause in its message", () => {
    const cause = new Error("Underlying import failure");
    const error = new PluginModuleNotFoundError({
      specifier: "broken-plugin",
      cause,
    });

    expect(error.message).toBe(
      "Failed to load plugin module 'broken-plugin': Underlying import failure"
    );
  });

  test("PluginModuleNotFoundError tolerates non-Error causes", () => {
    const error = new PluginModuleNotFoundError({
      specifier: "broken-plugin",
      cause: "string-cause",
    });

    expect(error.message).toBe(
      "Failed to load plugin module 'broken-plugin': string-cause"
    );
  });
});
