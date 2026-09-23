import { PluginRegistry } from "@rexeus/typeweaver-gen";
import { Context, Effect, FileSystem, Layer } from "effect";
import { ConfigLoader } from "./ConfigLoader.js";
import { PluginLoader } from "./PluginLoaderService.js";
import { diagnoseProject } from "./projectDoctorDiagnosis.js";
import { ProjectValidator } from "./ProjectValidator.js";
import type {
  DiagnoseProjectParams,
  ProjectDoctorServices,
} from "./projectDoctorTypes.js";

const makeProjectDoctor = Effect.gen(function* () {
  const configLoader = yield* ConfigLoader;
  const pluginLoader = yield* PluginLoader;
  const pluginRegistry = yield* PluginRegistry;
  const projectValidator = yield* ProjectValidator;
  const services: ProjectDoctorServices = {
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
