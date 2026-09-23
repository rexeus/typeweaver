import { Cause, Exit, Option } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { PluginLoadError } from "../../src/errors/PluginLoadError.js";
import { TestAssertionError } from "../errors/index.js";
import {
  configWithPlugin,
  createPluginFixtureWorkspace,
  importPathForFile,
  requiredTypesPlugin,
  runLoadPlugins,
  runLoadPluginsExit,
} from "../helpers/index.js";
import type {
  PluginLoaderRunResult,
  RegisteredPlugin,
} from "../helpers/index.js";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

const fixtures = createPluginFixtureWorkspace();

const writePluginModule = fixtures.writePluginModule;

afterEach(() => {
  fixtures.cleanup();
});

const capturePluginLoadError = async (
  load: Promise<PluginLoaderRunResult>
): Promise<PluginLoadError> => {
  const failure: unknown = await load.then(
    () => undefined,
    (error: unknown) => error
  );

  if (!(failure instanceof PluginLoadError)) {
    throw new TestAssertionError(
      `Expected plugin loading to fail with PluginLoadError, received: ${failure instanceof Error ? failure.message : String(failure)}`
    );
  }

  return failure;
};

describe("pluginLoader real-module validation", () => {
  test("rejects an invalid default export from a real module before registration", async () => {
    const pluginPath = writePluginModule([
      'export default { name: "invalid-plugin", generate: 42 };',
    ]);
    const registeredPlugins: RegisteredPlugin[] = [];

    const exit = await runLoadPluginsExit({
      registeredPlugins,
      requiredPlugins: [],
      strategies: ["local"],
      config: configWithPlugin(pluginPath),
      useRealModuleLoader: true,
    });

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(causeDefects(exit.cause)).toHaveLength(0);
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(PluginLoadError);
      }
      if (Option.isSome(failure) && failure.value instanceof PluginLoadError) {
        expect(failure.value.attempts).toEqual([
          {
            path: importPathForFile(pluginPath),
            error: expect.stringContaining("field 'generate'") as unknown,
          },
        ]);
      }
    }
    expect(registeredPlugins).toEqual([]);
  });
  test("reports a scoped package attempt when the scoped strategy cannot load it", async () => {
    const failure = await capturePluginLoadError(
      runLoadPlugins({
        registeredPlugins: [],
        requiredPlugins: [requiredTypesPlugin()],
        strategies: ["scoped"],
        config: configWithPlugin("@example/missing-plugin"),
      })
    );

    expect(failure.pluginName).toBe("@example/missing-plugin");
    expect(failure.attempts).toEqual([
      {
        path: "@example/missing-plugin",
        error: expect.stringMatching(/\S/) as unknown,
      },
    ]);
  });
});
