import { Effect, Layer } from "effect";
import { PluginModuleNotFoundError } from "../../src/services/errors/PluginModuleNotFoundError.js";
import { isPluginConfigError } from "../../src/services/isPluginConfigError.js";
import { PluginModuleLoader } from "../../src/services/PluginModuleLoader.js";

const MODULE_IMPORT_FAILURE_FIXTURE: unique symbol = Symbol(
  "ModuleImportFailureFixture"
);

export type ModuleImportFailureFixture = {
  readonly [MODULE_IMPORT_FAILURE_FIXTURE]: true;
  readonly error: unknown;
};

export type ModuleFixture =
  | Record<string, unknown>
  | ModuleImportFailureFixture;

export const aModuleImportFailure = (
  error: unknown
): ModuleImportFailureFixture => ({
  [MODULE_IMPORT_FAILURE_FIXTURE]: true,
  error,
});

const isFailedImportFixture = (
  fixture: ModuleFixture
): fixture is ModuleImportFailureFixture =>
  typeof fixture === "object" &&
  fixture !== null &&
  (fixture as { readonly [MODULE_IMPORT_FAILURE_FIXTURE]?: unknown })[
    MODULE_IMPORT_FAILURE_FIXTURE
  ] === true;

/**
 * Builds a test layer for `PluginModuleLoader` that resolves specifiers
 * against an in-memory module map. Specifiers absent from the map fail
 * with `PluginModuleNotFoundError`, matching the production behavior of
 * a failed dynamic `import()`.
 *
 * Tests prefer this over writing `.mjs` fixtures to disk because module
 * resolution mechanics are irrelevant to the consumer's branching — what
 * matters is which exports are observed and how the loader reports
 * failure.
 */
export const inMemoryPluginModuleLoader = (
  modules: ReadonlyMap<string, ModuleFixture>
): Layer.Layer<PluginModuleLoader> => {
  const service = PluginModuleLoader.make({
    load: (specifier: string) => {
      const moduleRecord = modules.get(specifier);
      if (moduleRecord === undefined) {
        return Effect.fail(
          new PluginModuleNotFoundError({
            specifier,
            cause: new Error(
              `Cannot find module '${specifier}' imported from in-memory map`
            ),
          })
        );
      }
      if (isFailedImportFixture(moduleRecord)) {
        if (isPluginConfigError(moduleRecord.error)) {
          return Effect.fail(moduleRecord.error);
        }
        return Effect.fail(
          new PluginModuleNotFoundError({
            specifier,
            cause: moduleRecord.error,
          })
        );
      }
      return Effect.succeed(moduleRecord);
    },
  });

  return Layer.succeed(PluginModuleLoader, service);
};
