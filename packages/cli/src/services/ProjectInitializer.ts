import path from "node:path";
import { Context, Effect, FileSystem, Layer } from "effect";
import { executePlan } from "./internal/projectPublishing.js";
import {
  findOverwrittenFiles,
  inspectTarget,
  nextStepsFor,
  planProject,
} from "./projectInitializationPlan.js";
import type { ProjectInitFailure } from "../errors/ProjectInitError.js";

export type InitConfigFormat = "mjs" | "cjs" | "js";

export type InitializeProjectParams = {
  readonly targetDir: string;
  readonly currentWorkingDirectory: string;
  readonly templateDir: string;
  readonly typeweaverVersion: string;
  readonly zodVersion: string;
  readonly configFormat?: InitConfigFormat | undefined;
  readonly force: boolean;
  readonly dryRun: boolean;
};

export type InitializeProjectResult = {
  readonly targetDir: string;
  readonly configFile: string;
  readonly files: readonly string[];
  readonly overwrittenFiles: readonly string[];
  readonly preservedFiles: readonly string[];
  readonly nextSteps: readonly string[];
  readonly dryRun: boolean;
};

type ProjectInitializerDependencies = {
  readonly fileSystem: FileSystem.FileSystem;
};

const createInitialize = ({ fileSystem }: ProjectInitializerDependencies) =>
  Effect.fn("typeweaver.ProjectInitializer.initialize")(
    (params: InitializeProjectParams) =>
      Effect.gen(function* () {
        const targetDir = path.resolve(
          params.currentWorkingDirectory,
          params.targetDir
        );
        const preflight = yield* inspectTarget(
          fileSystem,
          targetDir,
          params.force
        );
        const planned = yield* planProject(fileSystem, params, preflight);
        const overwrittenFiles = yield* findOverwrittenFiles(
          fileSystem,
          targetDir,
          planned.plan
        );
        if (!params.dryRun) {
          yield* executePlan(fileSystem, targetDir, planned.plan, params.force);
        }
        return {
          targetDir,
          configFile: planned.configFile,
          files: planned.plan.map(file => file.path),
          overwrittenFiles,
          preservedFiles: preflight.packageExists ? ["package.json"] : [],
          nextSteps: nextStepsFor(
            targetDir,
            planned.configFile,
            preflight.packageExists
          ),
          dryRun: params.dryRun,
        } satisfies InitializeProjectResult;
      })
  );

export type ProjectInitializerShape = {
  readonly initialize: (
    params: InitializeProjectParams
  ) => Effect.Effect<InitializeProjectResult, ProjectInitFailure>;
};

const makeProjectInitializer: Effect.Effect<
  ProjectInitializerShape,
  never,
  FileSystem.FileSystem
> = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  const initialize = createInitialize({ fileSystem });

  return { initialize };
});

export class ProjectInitializer extends Context.Service<
  ProjectInitializer,
  ProjectInitializerShape
>()("typeweaver/ProjectInitializer") {
  static readonly make = (service: ProjectInitializerShape) => service;

  static readonly Default: Layer.Layer<
    ProjectInitializer,
    never,
    FileSystem.FileSystem
  > = Layer.effect(ProjectInitializer, makeProjectInitializer);

  static readonly initialize = (params: InitializeProjectParams) =>
    ProjectInitializer.use(service => service.initialize(params));
}
