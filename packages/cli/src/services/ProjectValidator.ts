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

const linkNearestNodeModules = Effect.fn(function* (
  fileSystem: FileSystem.FileSystem,
  currentWorkingDirectory: string,
  temporaryDirectory: string
) {
  let searchDirectory = path.resolve(currentWorkingDirectory);
  while (true) {
    const nodeModulesDirectory = path.join(searchDirectory, "node_modules");
    if (yield* fileSystem.exists(nodeModulesDirectory)) {
      yield* fileSystem.symlink(
        nodeModulesDirectory,
        path.join(temporaryDirectory, "node_modules")
      );
      return;
    }

    const parentDirectory = path.dirname(searchDirectory);
    if (parentDirectory === searchDirectory) {
      return;
    }
    searchDirectory = parentDirectory;
  }
});

export class ProjectValidator extends Effect.Service<ProjectValidator>()(
  "typeweaver/ProjectValidator",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const pluginLoader = yield* PluginLoader;
      const pluginRegistry = yield* PluginRegistry;
      const specLoader = yield* SpecLoader;

      const validate = Effect.fn("typeweaver.ProjectValidator.validate")(
        (params: ValidateProjectParams) =>
          Effect.scoped(
            Effect.gen(function* () {
              const inputFile = path.resolve(
                params.currentWorkingDirectory,
                params.inputFile
              );
              const temporaryDirectory =
                yield* fileSystem.makeTempDirectoryScoped({
                  prefix: "typeweaver-validate-",
                });
              yield* linkNearestNodeModules(
                fileSystem,
                params.currentWorkingDirectory,
                temporaryDirectory
              );
              const registry = yield* pluginRegistry.createInstance();

              yield* pluginLoader.loadAll({
                registry,
                requiredPlugins: defaultRequiredPlugins(),
                strategies: DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
                config: params.config,
              });
              const loaded = yield* specLoader.load({
                inputFile,
                specOutputDir: path.join(temporaryDirectory, "spec"),
              });
              const validationContext: PluginValidationContext = {
                inputDir: path.dirname(inputFile),
                config: { ...params.config },
              };
              const pluginIssues = yield* registry.validate({
                normalizedSpec: loaded.normalizedSpec,
                context: validationContext,
              });

              return {
                issues: [
                  ...loaded.normalizedSpec.warnings.map(
                    normalizedSpecWarningToIssue
                  ),
                  ...pluginIssues,
                ],
              };
            })
          )
      );

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
