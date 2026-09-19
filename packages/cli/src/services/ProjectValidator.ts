import path from "node:path";
import {
  PluginRegistry,
  normalizedSpecWarningToIssue,
} from "@rexeus/typeweaver-gen";
import type {
  Issue,
  PluginValidationContext,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
} from "./generatorDefaults.js";
import { linkNearestNodeModules } from "./internal/projectStaging.js";
import { PluginLoader } from "./PluginLoader.js";
import { SpecLoader } from "./SpecLoader.js";

export type ValidateProjectParams = {
  readonly inputFile: string;
  readonly config: Partial<TypeweaverConfig> & { readonly input: string };
  readonly currentWorkingDirectory: string;
};

export type ValidateProjectResult = {
  readonly issues: readonly Issue[];
};

type StagedValidationDeps = {
  readonly pluginLoader: PluginLoader;
  readonly pluginRegistry: PluginRegistry;
  readonly specLoader: SpecLoader;
  readonly inputFile: string;
  readonly temporaryDirectory: string;
  readonly currentWorkingDirectory: string;
  readonly config: Partial<TypeweaverConfig> & { readonly input: string };
};

const runStagedValidation = (deps: StagedValidationDeps) =>
  Effect.gen(function* () {
    const registry = yield* deps.pluginRegistry.createInstance();

    yield* deps.pluginLoader.loadAll({
      registry,
      requiredPlugins: defaultRequiredPlugins(),
      strategies: DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
      config: deps.config,
    });
    const loaded = yield* deps.specLoader.load({
      inputFile: deps.inputFile,
      specOutputDir: path.join(deps.temporaryDirectory, "spec"),
      isolatedImport: true,
      externalImportBase: path.resolve(deps.currentWorkingDirectory, "spec.js"),
    });
    const validationContext: PluginValidationContext = {
      inputDir: path.dirname(deps.inputFile),
      config: { ...deps.config },
    };
    const pluginIssues = yield* registry.validate({
      normalizedSpec: loaded.normalizedSpec,
      context: validationContext,
    });

    return {
      issues: [
        ...loaded.normalizedSpec.warnings.map(warning =>
          normalizedSpecWarningToIssue(warning, loaded.normalizedSpec)
        ),
        ...pluginIssues,
      ],
    };
  });

export class ProjectValidator extends Effect.Service<ProjectValidator>()(
  "typeweaver/ProjectValidator",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const pluginLoader = yield* PluginLoader;
      const pluginRegistry = yield* PluginRegistry;
      const specLoader = yield* SpecLoader;

      const validate = Effect.fn("typeweaver.ProjectValidator.validate")((
        params: ValidateProjectParams
      ) => {
        const inputFile = path.resolve(
          params.currentWorkingDirectory,
          params.inputFile
        );
        return Effect.scoped(
          Effect.gen(function* () {
            const temporaryDirectory =
              yield* fileSystem.makeTempDirectoryScoped({
                prefix: "typeweaver-validate-",
              });
            yield* linkNearestNodeModules(
              fileSystem,
              params.currentWorkingDirectory,
              temporaryDirectory
            );
            return yield* runStagedValidation({
              pluginLoader,
              pluginRegistry,
              specLoader,
              inputFile,
              temporaryDirectory,
              currentWorkingDirectory: params.currentWorkingDirectory,
              config: params.config,
            });
          })
        );
      });

      return { validate } as const;
    }),
    dependencies: [
      PluginLoader.Default,
      PluginRegistry.Default,
      SpecLoader.Default,
    ],
    accessors: true,
  }
) {}
