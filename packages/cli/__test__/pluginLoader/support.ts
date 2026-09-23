import type {
  Plugin,
  PluginConfig,
  PluginRegistryInstance,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import {
  Cause,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
  Ref,
} from "effect";
import { withCapturedLogs } from "test-utils/src/effect/index.js";
import { expect } from "vitest";
import { PluginLoadError } from "../../src/errors/PluginLoadError.js";
import { PluginLoader, PluginModuleLoader } from "../../src/services/index.js";
import { isPluginConfigError } from "../../src/services/isPluginConfigError.js";
import { TestAssertionError } from "../errors/index.js";
import { inMemoryPluginModuleLoader } from "../helpers/inMemoryPluginModuleLoader.js";
import type { TaggedPluginConfigError } from "../../src/services/isPluginConfigError.js";
import type { ModuleFixture } from "../helpers/inMemoryPluginModuleLoader.js";

export type CapturedLog = {
  readonly level: string;
  readonly message: string;
};

export type RegisteredPlugin = {
  readonly name: string;
  readonly plugin: Plugin;
  readonly config?: unknown;
};

export type PluginLoaderRunParams = {
  readonly registeredPlugins: RegisteredPlugin[];
  readonly requiredPlugins: readonly Plugin[];
  readonly strategies: readonly ("npm" | "local" | "scoped")[];
  readonly config?: TypeweaverConfig;
  readonly modules?: ReadonlyMap<string, ModuleFixture>;
  readonly useRealModuleLoader?: boolean;
};

export type PluginLoaderRunResult = {
  readonly logs: readonly CapturedLog[];
};

export const requiredTypesPlugin = (): Plugin => ({
  name: "types",
});

export const configWithPlugin = (
  plugin: string | [string, PluginConfig]
): TypeweaverConfig => ({
  input: "./spec.ts",
  output: "./generated",
  plugins: [plugin],
});

const createRecordingPluginRegistry = (
  registeredPlugins: RegisteredPlugin[]
): Effect.Effect<PluginRegistryInstance> =>
  Effect.gen(function* () {
    const ref = yield* Ref.make(new Set<string>());

    const register = (plugin: Plugin, config?: unknown): Effect.Effect<void> =>
      Effect.gen(function* () {
        const known = yield* Ref.get(ref);
        if (known.has(plugin.name)) {
          return;
        }
        yield* Ref.update(ref, set => {
          const next = new Set(set);
          next.add(plugin.name);
          return next;
        });
        registeredPlugins.push({
          name: plugin.name,
          plugin,
          config,
        });
      });

    return {
      register,
      getAll: Effect.succeed([] as never),
      validate: () => Effect.succeed([]),
    } satisfies PluginRegistryInstance;
  });

export const runLoadPluginsExit = async (params: PluginLoaderRunParams) => {
  const moduleLoaderLayer = params.useRealModuleLoader
    ? PluginModuleLoader.Default
    : inMemoryPluginModuleLoader(params.modules ?? new Map());
  const layer = Layer.provide(
    PluginLoader.DefaultWithoutDependencies,
    moduleLoaderLayer
  );
  const runtime = ManagedRuntime.make(layer);
  try {
    return await runtime.runPromiseExit(
      withCapturedLogs(
        Effect.gen(function* () {
          const registry = yield* createRecordingPluginRegistry(
            params.registeredPlugins
          );
          yield* PluginLoader.loadAll({
            registry,
            requiredPlugins: params.requiredPlugins,
            strategies: params.strategies,
            config: params.config,
          });
        })
      )
    );
  } finally {
    await runtime.dispose();
  }
};

export const runLoadPlugins = async (
  params: PluginLoaderRunParams
): Promise<PluginLoaderRunResult> => {
  const exit = await runLoadPluginsExit(params);

  if (Exit.isFailure(exit)) {
    const failureOption = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failureOption)) {
      throw failureOption.value;
    }
    throw new Error(Cause.pretty(exit.cause));
  }

  return { logs: exit.value.logs };
};

export type CapturedPluginConfigError = TaggedPluginConfigError & {
  readonly message?: string;
};

export const capturePluginLoadError = async (
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

export const captureTaggedPluginConfigError = async (
  load: Promise<PluginLoaderRunResult>
): Promise<CapturedPluginConfigError> => {
  const failure: unknown = await load.then(
    () => undefined,
    (error: unknown) => error
  );

  if (!isPluginConfigError(failure)) {
    throw new TestAssertionError(
      `Expected plugin loading to fail with PluginConfigError, received: ${failure instanceof Error ? failure.message : String(failure)}`
    );
  }

  return failure;
};

export const anIncompletePluginConfigTag = (
  pluginName: string
): { readonly _tag: "PluginConfigError"; readonly pluginName: string } => ({
  _tag: "PluginConfigError",
  pluginName,
});

export type SuccessfulLoadSummaryEntry = {
  readonly pluginName: string;
  readonly source: string;
};

export const messages = (logs: readonly CapturedLog[]): readonly string[] =>
  logs.map(log => log.message);

export const expectSuccessfulLoadSummaryEntries = (
  logs: readonly CapturedLog[],
  expected: {
    readonly count: number;
    readonly entries: readonly SuccessfulLoadSummaryEntry[];
  }
): void => {
  const observed = messages(logs);

  expect(observed).toContain(
    `Successfully loaded ${expected.count} plugin(s):`
  );
  for (const entry of expected.entries) {
    expect(observed).toContain(
      `  - ${entry.pluginName} (from ${entry.source})`
    );
  }
};

export const expectSuccessfulLoadSummary = (
  logs: readonly CapturedLog[],
  expected: {
    readonly count: number;
    readonly pluginName: string;
    readonly source: string;
  }
): void => {
  expectSuccessfulLoadSummaryEntries(logs, {
    count: expected.count,
    entries: [{ pluginName: expected.pluginName, source: expected.source }],
  });
};
