import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Effect, Either, Layer, ManagedRuntime } from "effect";
import { describe, expect, test } from "vitest";
import { PluginModuleNotFoundError } from "../../src/services/errors/PluginModuleNotFoundError.js";
import { isPluginConfigError } from "../../src/services/isPluginConfigError.js";
import { PluginModuleLoader } from "../../src/services/PluginModuleLoader.js";

/**
 * Builds a `PluginModuleLoader` layer backed by an in-memory map of
 * specifier → module record. Tests prefer this over writing real `.mjs`
 * fixtures to disk because module resolution behavior is irrelevant when
 * the goal is to exercise the consumer's branching.
 */
const inMemoryPluginModuleLoader = (
  modules: ReadonlyMap<string, Record<string, unknown>>
): Layer.Layer<PluginModuleLoader> => {
  const service = PluginModuleLoader.make({
    load: (specifier: string) => {
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
  });

  return Layer.succeed(PluginModuleLoader, service);
};

const aNamedPluginModule = (): Record<string, unknown> => ({
  namedPlugin: { name: "named-plugin" },
});

const runWithModules = async <A, E>(
  modules: ReadonlyMap<string, Record<string, unknown>>,
  effect: Effect.Effect<A, E, PluginModuleLoader>
): Promise<A> => {
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

    if (!(result.left instanceof PluginModuleNotFoundError)) {
      throw new Error("Expected PluginModuleNotFoundError");
    }
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

  test("Default layer fails with PluginModuleNotFoundError when the specifier cannot be resolved by Node", async () => {
    // Exercises the real `import(specifier)` seam (not the in-memory fake)
    // so the `tryPromise` -> `catch` mapping in `PluginModuleLoader.Default`
    // is covered end-to-end. The specifier is intentionally bizarre so no
    // package manager could ever satisfy it.
    const unresolvableSpecifier = "definitely-not-a-real-package-xyz123";

    const runtime = ManagedRuntime.make(PluginModuleLoader.Default);
    try {
      const result = await runtime.runPromise(
        Effect.either(PluginModuleLoader.load(unresolvableSpecifier))
      );

      if (!Either.isLeft(result)) {
        throw new Error(
          "Expected the real loader to fail for an unresolvable specifier"
        );
      }

      if (!(result.left instanceof PluginModuleNotFoundError)) {
        throw new Error("Expected PluginModuleNotFoundError");
      }
      expect(result.left.specifier).toBe(unresolvableSpecifier);
      // The underlying Node module-not-found error must be preserved on the
      // `cause` field so operators can inspect what Node actually reported.
      expect(result.left.cause).toBeDefined();
    } finally {
      await runtime.dispose();
    }
  });

  test("Default layer preserves PluginConfigError thrown during module evaluation", async () => {
    const tempDir = await mkdtemp(
      path.join(process.cwd(), "plugin-module-loader-")
    );
    const pluginPath = path.join(tempDir, "misconfigured-plugin.mjs");
    await writeFile(
      pluginPath,
      [
        'import { PluginConfigError } from "@rexeus/typeweaver-gen";',
        "throw new PluginConfigError({",
        '  pluginName: "misconfigured-plugin",',
        '  reason: "outputPath must end with .json",',
        "});",
      ].join("\n")
    );

    const runtime = ManagedRuntime.make(PluginModuleLoader.Default);
    try {
      const result = await runtime.runPromise(
        Effect.either(PluginModuleLoader.load(pathToFileURL(pluginPath).href))
      );

      if (!Either.isLeft(result)) {
        throw new Error(
          "Expected the real loader to fail for a misconfigured plugin module"
        );
      }

      expect(result.left).not.toBeInstanceOf(PluginModuleNotFoundError);
      expect(isPluginConfigError(result.left)).toBe(true);
      if (!isPluginConfigError(result.left)) {
        throw new Error("Expected a tagged PluginConfigError");
      }
      expect(result.left._tag).toBe("PluginConfigError");
      expect(result.left.pluginName).toBe("misconfigured-plugin");
      expect(result.left.reason).toBe("outputPath must end with .json");
    } finally {
      await runtime.dispose();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
