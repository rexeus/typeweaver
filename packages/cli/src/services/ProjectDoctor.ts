import type { PluginRegistryShape } from "@rexeus/typeweaver-gen";
import { PluginRegistry } from "@rexeus/typeweaver-gen";
import { Context, Effect, FileSystem, Layer } from "effect";
import { ConfigLoader } from "./ConfigLoader.js";
import {
  checkEffectReference,
  checkFormatter,
  checkInput,
  checkNodeVersion,
  checkOutput,
  checkPackageManager,
  checkRuntime,
  checkWorkspaceEffectCompatibility,
} from "./doctorEnvironment.js";
import { PluginLoader } from "./PluginLoaderService.js";
import { checkDeepValidation, checkPlugins } from "./projectDoctorChecks.js";
import { loadInputs } from "./projectDoctorInputs.js";
import { ProjectValidator } from "./ProjectValidator.js";
import type { DoctorCheck } from "../reports/DoctorReport.js";
import type { ConfigLoaderShape } from "./ConfigLoader.js";
import type { PluginLoaderShape } from "./PluginLoaderService.js";
import type { DiagnoseProjectParams } from "./projectDoctorTypes.js";
import type { ProjectValidatorShape } from "./ProjectValidator.js";

export type { DiagnoseProjectParams };

const diagnoseProject = (
  services: {
    readonly configLoader: ConfigLoaderShape;
    readonly pluginLoader: PluginLoaderShape;
    readonly pluginRegistry: PluginRegistryShape;
    readonly projectValidator: ProjectValidatorShape;
  },
  params: DiagnoseProjectParams
): Effect.Effect<readonly DoctorCheck[]> =>
  Effect.gen(function* () {
    const resolved = yield* loadInputs(services.configLoader, params);
    const inputCheck = yield* checkInput(resolved.inputs.inputFile);
    const pluginCheck = yield* checkPlugins(
      services.pluginLoader,
      services.pluginRegistry,
      resolved.inputs
    );
    const outputCheck = yield* checkOutput(
      resolved.inputs.outputDir,
      resolved.inputs.inputFile,
      params.currentWorkingDirectory
    );
    const effectCheck = yield* checkEffectReference();
    const formatterCheck = yield* checkFormatter(resolved.inputs.config.format);
    const workspaceEffectCheck = yield* checkWorkspaceEffectCompatibility(
      resolved.inputs.config,
      params.currentWorkingDirectory
    );
    const deepCheck = yield* checkDeepValidation(services.projectValidator, {
      inputs: resolved.inputs,
      prerequisiteChecks: [
        resolved.configCheck,
        inputCheck,
        pluginCheck,
        workspaceEffectCheck,
      ],
      deep: params.deep,
      currentWorkingDirectory: params.currentWorkingDirectory,
    });
    return [
      checkRuntime(),
      checkNodeVersion(),
      checkPackageManager(),
      resolved.configCheck,
      inputCheck,
      pluginCheck,
      outputCheck,
      effectCheck,
      formatterCheck,
      deepCheck,
      workspaceEffectCheck,
    ];
  });

const makeProjectDoctor = Effect.gen(function* () {
  const configLoader = yield* ConfigLoader;
  const pluginLoader = yield* PluginLoader;
  const pluginRegistry = yield* PluginRegistry;
  const projectValidator = yield* ProjectValidator;
  const services = {
    configLoader,
    pluginLoader,
    pluginRegistry,
    projectValidator,
  };
  return {
    diagnose: Effect.fn("typeweaver.ProjectDoctor.diagnose")(
      (params: DiagnoseProjectParams) => diagnoseProject(services, params)
    ),
  } as const;
});

export type ProjectDoctorShape = Effect.Success<typeof makeProjectDoctor>;

export class ProjectDoctor extends Context.Service<
  ProjectDoctor,
  ProjectDoctorShape
>()("typeweaver/ProjectDoctor") {
  static readonly make = (service: ProjectDoctorShape) => service;

  static readonly Default: Layer.Layer<
    ProjectDoctor,
    never,
    FileSystem.FileSystem
  > = Layer.effect(ProjectDoctor, makeProjectDoctor).pipe(
    Layer.provide(ConfigLoader.Default),
    Layer.provide(PluginLoader.Default),
    Layer.provide(PluginRegistry.Default),
    Layer.provide(ProjectValidator.Default)
  );

  static readonly diagnose = (params: DiagnoseProjectParams) =>
    ProjectDoctor.use(service => service.diagnose(params));
}
