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
import { PluginLoader, PluginModuleLoader } from "../../src/services/index.js";
import { inMemoryPluginModuleLoader } from "../helpers/inMemoryPluginModuleLoader.js";
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
