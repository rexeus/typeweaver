import path from "node:path";
import {
  PluginRegistry,
  normalizedSpecWarningToIssue,
} from "@rexeus/typeweaver-gen";
import type {
  Issue,
  NormalizationError,
  PluginConfigError,
  PluginDependencyError,
  PluginExecutionError,
  PluginRegistryShape,
  PluginValidationContext,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Context, Effect, FileSystem, Layer } from "effect";
import { PluginLoadError } from "../errors/PluginLoadError.js";
import {
  InvalidSpecEntrypointError,
  SpecBundleError,
  SpecBundleOutputMissingError,
  SpecOutputWriteError,
} from "./errors/specErrors.js";
import {
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
} from "./generatorDefaults.js";
import { linkNearestNodeModules } from "./internal/projectStaging.js";
import { PluginLoader } from "./PluginLoaderService.js";
import { SpecLoader } from "./SpecLoader.js";
import type { PluginLoaderShape } from "./PluginLoaderService.js";
import type { SpecLoaderShape } from "./SpecLoader.js";
import type { PlatformError } from "effect/PlatformError";

export type ValidateProjectParams = {
  readonly inputFile: string;
  readonly config: Partial<TypeweaverConfig> & { readonly input: string };
  readonly currentWorkingDirectory: string;
};

export type ValidateProjectResult = {
  readonly issues: readonly Issue[];
};

type StagedValidationDeps = {
  readonly pluginLoader: PluginLoaderShape;
  readonly pluginRegistry: PluginRegistryShape;
  readonly specLoader: SpecLoaderShape;
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

export type ProjectValidatorError =
  | PluginLoadError
  | PluginConfigError
  | PluginDependencyError
  | PluginExecutionError
  | SpecBundleError
  | SpecBundleOutputMissingError
  | SpecOutputWriteError
  | InvalidSpecEntrypointError
  | NormalizationError
  | PlatformError;

export type ProjectValidatorShape = {
  readonly validate: (
    params: ValidateProjectParams
  ) => Effect.Effect<ValidateProjectResult, ProjectValidatorError>;
};

const makeProjectValidator: Effect.Effect<
  ProjectValidatorShape,
  never,
  FileSystem.FileSystem | PluginLoader | PluginRegistry | SpecLoader
> = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const pluginLoader = yield* PluginLoader;
  const pluginRegistry = yield* PluginRegistry;
  const specLoader = yield* SpecLoader;

  const validate: ProjectValidatorShape["validate"] = Effect.fn(
    "typeweaver.ProjectValidator.validate"
  )((params: ValidateProjectParams) => {
    const inputFile = path.resolve(
      params.currentWorkingDirectory,
      params.inputFile
    );
    return Effect.scoped(
      Effect.gen(function* () {
        const temporaryDirectory = yield* fileSystem.makeTempDirectoryScoped({
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
});

export class ProjectValidator extends Context.Service<
  ProjectValidator,
  ProjectValidatorShape
>()("typeweaver/ProjectValidator") {
  static readonly make = (service: ProjectValidatorShape) => service;

  static readonly Default: Layer.Layer<
    ProjectValidator,
    never,
    FileSystem.FileSystem
  > = Layer.effect(ProjectValidator, makeProjectValidator).pipe(
    Layer.provide(PluginLoader.Default),
    Layer.provide(PluginRegistry.Default),
    Layer.provide(SpecLoader.Default)
  );

  static readonly validate = (params: ValidateProjectParams) =>
    ProjectValidator.use(service => service.validate(params));
}
