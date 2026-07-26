import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect, Either } from "effect";
import {
  InitFileConflictError,
  InitTargetNotDirectoryError,
  InitTargetNotEmptyError,
  InvalidInitPackageError,
  ProjectInitFileSystemError,
  ProjectInitRollbackError,
} from "../errors/ProjectInitError.js";
import type {
  ProjectInitFailure,
  ProjectInitFileSystemOperation,
} from "../errors/ProjectInitError.js";
import type { PlatformError } from "@effect/platform/Error";

export type InitConfigFormat = "mjs" | "cjs" | "js";

export type InitializeProjectParams = {
  readonly targetDir: string;
  readonly currentWorkingDirectory: string;
  readonly templateDir: string;
  readonly typeweaverVersion: string;
  readonly zodVersion: string;
  readonly configFormat?: InitConfigFormat;
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

type PlannedInitFile = {
  readonly path: string;
  readonly content: string;
};

type TargetPreflight = {
  readonly targetExists: boolean;
  readonly packageExists: boolean;
  readonly packageType?: string;
};

type CommittedFile = {
  readonly targetPath: string;
  readonly backupPath?: string;
};

type PublishProjectParams = {
  readonly targetDir: string;
  readonly stagingDir: string;
  readonly plan: readonly PlannedInitFile[];
  readonly force: boolean;
};

const STATIC_TEMPLATE_FILES = [
  "README.md",
  "tsconfig.json",
  ".gitignore",
  "api/spec/index.ts",
  "api/spec/todo/schemas.ts",
  "api/spec/todo/CreateTodoOperation.ts",
  "api/spec/todo/UpdateTodoOperation.ts",
  "api/spec/todo/GetTodoOperation.ts",
  "api/spec/todo/ListTodoOperation.ts",
  "api/spec/todo/QueryTodoOperation.ts",
  "api/spec/todo/errors/TodoNotFoundError.ts",
  "api/spec/shared/errors/ValidationError.ts",
  "api/spec/shared/errors/UnauthorizedError.ts",
  "api/spec/shared/errors/ForbiddenError.ts",
  "api/spec/shared/errors/NotFoundError.ts",
  "api/spec/shared/errors/ConflictError.ts",
  "api/spec/shared/errors/InternalServerError.ts",
  "api/spec/shared/errors/index.ts",
];

const fileSystemError =
  (operation: ProjectInitFileSystemOperation, targetPath: string) =>
  (cause: PlatformError): ProjectInitFileSystemError =>
    new ProjectInitFileSystemError({
      operation,
      path: targetPath,
      cause,
    });

const resolveConfigFormat = (
  requested: InitConfigFormat | undefined,
  preflight: TargetPreflight
): InitConfigFormat => {
  if (requested !== undefined) return requested;
  if (!preflight.packageExists) return "mjs";
  return preflight.packageType === "module" ? "js" : "cjs";
};

const isEsmConfig = (
  format: InitConfigFormat,
  preflight: TargetPreflight
): boolean =>
  format === "mjs" ||
  (format === "js" &&
    (!preflight.packageExists || preflight.packageType === "module"));

const renderTemplate = (
  source: string,
  params: Pick<InitializeProjectParams, "typeweaverVersion" | "zodVersion"> & {
    readonly configFile: string;
  }
): string =>
  source
    .replaceAll("{{typeweaverVersion}}", params.typeweaverVersion)
    .replaceAll("{{zodVersion}}", params.zodVersion)
    .replaceAll("{{configFile}}", params.configFile);

const decodePackageType = (
  source: string,
  packagePath: string
): Effect.Effect<string | undefined, InvalidInitPackageError> =>
  Effect.try({
    try: () => {
      const parsed: unknown = JSON.parse(source);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("manifest must contain a JSON object");
      }
      const packageType = Reflect.get(parsed, "type");
      if (
        packageType !== undefined &&
        packageType !== "module" &&
        packageType !== "commonjs"
      ) {
        throw new Error("'type' must be 'module' or 'commonjs' when present");
      }
      return packageType;
    },
    catch: cause =>
      new InvalidInitPackageError({
        packagePath,
        reason: cause instanceof Error ? cause.message : String(cause),
      }),
  });

const inspectTarget = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  force: boolean
): Effect.Effect<TargetPreflight, ProjectInitFailure> =>
  Effect.gen(function* () {
    const targetExists = yield* fileSystem
      .exists(targetDir)
      .pipe(Effect.mapError(fileSystemError("exists", targetDir)));
    if (targetExists) {
      const targetInfo = yield* fileSystem
        .stat(targetDir)
        .pipe(Effect.mapError(fileSystemError("stat", targetDir)));
      if (targetInfo.type !== "Directory") {
        return yield* new InitTargetNotDirectoryError({ targetDir });
      }
      const entries = yield* fileSystem
        .readDirectory(targetDir)
        .pipe(Effect.mapError(fileSystemError("readDirectory", targetDir)));
      entries.sort((left, right) => left.localeCompare(right));
      if (!force && entries.length > 0) {
        return yield* new InitTargetNotEmptyError({ targetDir, entries });
      }
    }

    const packagePath = path.join(targetDir, "package.json");
    const packageExists =
      targetExists &&
      (yield* fileSystem
        .exists(packagePath)
        .pipe(Effect.mapError(fileSystemError("exists", packagePath))));
    if (!packageExists) {
      return { targetExists, packageExists: false };
    }

    const packageSource = yield* fileSystem
      .readFileString(packagePath)
      .pipe(Effect.mapError(fileSystemError("readPackage", packagePath)));
    const packageType = yield* decodePackageType(packageSource, packagePath);
    return {
      targetExists,
      packageExists: true,
      ...(packageType === undefined ? {} : { packageType }),
    };
  });

const readTemplate = (
  fileSystem: FileSystem.FileSystem,
  templatePath: string
): Effect.Effect<string, ProjectInitFileSystemError> =>
  fileSystem
    .readFileString(templatePath)
    .pipe(Effect.mapError(fileSystemError("readTemplate", templatePath)));

const planProject = (
  fileSystem: FileSystem.FileSystem,
  params: InitializeProjectParams,
  preflight: TargetPreflight
): Effect.Effect<
  {
    readonly configFile: string;
    readonly plan: readonly PlannedInitFile[];
  },
  ProjectInitFileSystemError
> =>
  Effect.gen(function* () {
    const format = resolveConfigFormat(params.configFormat, preflight);
    const configFile = `typeweaver.config.${format}`;
    const files = [
      ...STATIC_TEMPLATE_FILES.map(relativePath => ({
        template: `${relativePath}.tmpl`,
        output: relativePath,
      })),
      {
        template: isEsmConfig(format, preflight)
          ? "config.esm.tmpl"
          : "config.cjs.tmpl",
        output: configFile,
      },
      ...(preflight.packageExists
        ? []
        : [{ template: "package.json.tmpl", output: "package.json" }]),
    ];
    const plan = yield* Effect.forEach(
      files,
      file =>
        readTemplate(
          fileSystem,
          path.join(params.templateDir, file.template)
        ).pipe(
          Effect.map(source => ({
            path: file.output,
            content: renderTemplate(source, {
              typeweaverVersion: params.typeweaverVersion,
              zodVersion: params.zodVersion,
              configFile,
            }),
          }))
        ),
      { concurrency: 1 }
    );
    return { configFile, plan };
  });

const findOverwrittenFiles = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  plan: readonly PlannedInitFile[]
): Effect.Effect<readonly string[], ProjectInitFileSystemError> =>
  Effect.filter(
    plan,
    file =>
      fileSystem
        .exists(path.join(targetDir, file.path))
        .pipe(
          Effect.mapError(
            fileSystemError("exists", path.join(targetDir, file.path))
          )
        ),
    { concurrency: 1 }
  ).pipe(Effect.map(files => files.map(file => file.path)));

const findNearestExistingDirectory = (
  fileSystem: FileSystem.FileSystem,
  startPath: string
): Effect.Effect<string, ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    let candidate = startPath;
    while (true) {
      const exists = yield* fileSystem
        .exists(candidate)
        .pipe(Effect.mapError(fileSystemError("exists", candidate)));
      if (exists) return candidate;
      const parent = path.dirname(candidate);
      if (parent === candidate) return candidate;
      candidate = parent;
    }
  });

const writeStagingTree = (
  fileSystem: FileSystem.FileSystem,
  stagingDir: string,
  plan: readonly PlannedInitFile[]
): Effect.Effect<void, ProjectInitFileSystemError> =>
  Effect.forEach(
    plan,
    file => {
      const stagedPath = path.join(stagingDir, "new", file.path);
      const stagedDirectory = path.dirname(stagedPath);
      return fileSystem
        .makeDirectory(stagedDirectory, { recursive: true })
        .pipe(
          Effect.mapError(fileSystemError("makeDirectory", stagedDirectory)),
          Effect.zipRight(
            fileSystem
              .writeFileString(stagedPath, file.content, { flag: "wx" })
              .pipe(Effect.mapError(fileSystemError("writeFile", stagedPath)))
          )
        );
    },
    { concurrency: 1, discard: true }
  );

const collectMissingDirectories = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  plan: readonly PlannedInitFile[]
): Effect.Effect<readonly string[], ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    const candidates = new Set<string>();
    for (const file of plan) {
      let candidate = path.dirname(path.join(targetDir, file.path));
      while (candidate.startsWith(targetDir)) {
        candidates.add(candidate);
        if (candidate === targetDir) break;
        candidate = path.dirname(candidate);
      }
    }
    let ancestor = path.dirname(targetDir);
    while (true) {
      const exists = yield* fileSystem
        .exists(ancestor)
        .pipe(Effect.mapError(fileSystemError("exists", ancestor)));
      if (exists) break;
      candidates.add(ancestor);
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    const missing = yield* Effect.filter(
      [...candidates],
      candidate =>
        fileSystem.exists(candidate).pipe(
          Effect.map(exists => !exists),
          Effect.mapError(fileSystemError("exists", candidate))
        ),
      { concurrency: 1 }
    );
    return missing.sort((left, right) => right.length - left.length);
  });

const restoreCurrentFile = (
  fileSystem: FileSystem.FileSystem,
  targetPath: string,
  backupPath: string
): Effect.Effect<void, ProjectInitFileSystemError> =>
  fileSystem
    .rename(backupPath, targetPath)
    .pipe(Effect.mapError(fileSystemError("rename", targetPath)));

const commitFile = (
  fileSystem: FileSystem.FileSystem,
  params: Omit<PublishProjectParams, "plan"> & {
    readonly file: PlannedInitFile;
  }
): Effect.Effect<CommittedFile, ProjectInitFailure> =>
  Effect.gen(function* () {
    const targetPath = path.join(params.targetDir, params.file.path);
    const stagedPath = path.join(params.stagingDir, "new", params.file.path);
    const targetExists = yield* fileSystem
      .exists(targetPath)
      .pipe(Effect.mapError(fileSystemError("exists", targetPath)));
    if (targetExists && !params.force) {
      return yield* new InitFileConflictError({ filePath: targetPath });
    }

    yield* fileSystem
      .makeDirectory(path.dirname(targetPath), { recursive: true })
      .pipe(
        Effect.mapError(
          fileSystemError("makeDirectory", path.dirname(targetPath))
        )
      );
    if (!targetExists) {
      yield* fileSystem
        .rename(stagedPath, targetPath)
        .pipe(Effect.mapError(fileSystemError("rename", targetPath)));
      return { targetPath };
    }

    const backupPath = path.join(params.stagingDir, "backup", params.file.path);
    yield* fileSystem
      .makeDirectory(path.dirname(backupPath), { recursive: true })
      .pipe(
        Effect.mapError(
          fileSystemError("makeDirectory", path.dirname(backupPath))
        )
      );
    yield* fileSystem
      .rename(targetPath, backupPath)
      .pipe(Effect.mapError(fileSystemError("rename", targetPath)));
    const published = yield* fileSystem
      .rename(stagedPath, targetPath)
      .pipe(
        Effect.mapError(fileSystemError("rename", targetPath)),
        Effect.either
      );
    if (Either.isLeft(published)) {
      yield* restoreCurrentFile(fileSystem, targetPath, backupPath);
      return yield* published.left;
    }
    return { targetPath, backupPath };
  });

const rollbackFiles = (
  fileSystem: FileSystem.FileSystem,
  committedFiles: readonly CommittedFile[],
  missingDirectories: readonly string[]
): Effect.Effect<void, ProjectInitFileSystemError> =>
  Effect.gen(function* () {
    for (const file of [...committedFiles].reverse()) {
      yield* fileSystem
        .remove(file.targetPath, { force: true })
        .pipe(Effect.mapError(fileSystemError("remove", file.targetPath)));
      if (file.backupPath !== undefined) {
        yield* fileSystem
          .rename(file.backupPath, file.targetPath)
          .pipe(Effect.mapError(fileSystemError("rename", file.targetPath)));
      }
    }
    for (const directory of missingDirectories) {
      const exists = yield* fileSystem
        .exists(directory)
        .pipe(Effect.mapError(fileSystemError("exists", directory)));
      if (!exists) continue;
      const entries = yield* fileSystem
        .readDirectory(directory)
        .pipe(Effect.mapError(fileSystemError("readDirectory", directory)));
      if (entries.length === 0) {
        yield* fileSystem
          .remove(directory)
          .pipe(Effect.mapError(fileSystemError("remove", directory)));
      }
    }
  });

const publishProject = (
  fileSystem: FileSystem.FileSystem,
  params: PublishProjectParams
): Effect.Effect<void, ProjectInitFailure> =>
  Effect.gen(function* () {
    const missingDirectories = yield* collectMissingDirectories(
      fileSystem,
      params.targetDir,
      params.plan
    );
    const committedFiles: CommittedFile[] = [];
    const committed = yield* Effect.forEach(
      params.plan,
      file =>
        commitFile(fileSystem, {
          targetDir: params.targetDir,
          stagingDir: params.stagingDir,
          file,
          force: params.force,
        }).pipe(
          Effect.tap(committedFile =>
            Effect.sync(() => {
              committedFiles.push(committedFile);
            })
          )
        ),
      { concurrency: 1, discard: true }
    ).pipe(Effect.either);
    if (Either.isRight(committed)) return;

    const rolledBack = yield* rollbackFiles(
      fileSystem,
      committedFiles,
      missingDirectories
    ).pipe(Effect.either);
    if (Either.isLeft(rolledBack)) {
      return yield* new ProjectInitRollbackError({
        targetDir: params.targetDir,
        originalCause: committed.left,
        rollbackCause: rolledBack.left,
      });
    }
    return yield* committed.left;
  }).pipe(Effect.uninterruptible);

const executePlan = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  plan: readonly PlannedInitFile[],
  force: boolean
): Effect.Effect<void, ProjectInitFailure> =>
  Effect.scoped(
    Effect.gen(function* () {
      const stagingParent = yield* findNearestExistingDirectory(
        fileSystem,
        path.dirname(targetDir)
      );
      const stagingDir = yield* fileSystem
        .makeTempDirectoryScoped({
          directory: stagingParent,
          prefix: `.typeweaver-init-${path.basename(targetDir)}-`,
        })
        .pipe(
          Effect.mapError(fileSystemError("makeTempDirectory", stagingParent))
        );
      yield* writeStagingTree(fileSystem, stagingDir, plan);
      yield* publishProject(fileSystem, {
        targetDir,
        stagingDir,
        plan,
        force,
      });
    })
  );

const nextStepsFor = (
  targetDir: string,
  configFile: string,
  packageExists: boolean
): readonly string[] => [
  `cd ${targetDir}`,
  ...(packageExists
    ? [
        `add scripts for 'typeweaver generate --config ./${configFile}' and 'typeweaver validate --config ./${configFile}' to package.json`,
        "install @rexeus/typeweaver, @rexeus/typeweaver-core, and zod",
      ]
    : ["pnpm install"]),
  "pnpm generate",
  "pnpm validate",
];

export class ProjectInitializer extends Effect.Service<ProjectInitializer>()(
  "typeweaver/ProjectInitializer",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const initialize = Effect.fn("typeweaver.ProjectInitializer.initialize")(
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
              yield* executePlan(
                fileSystem,
                targetDir,
                planned.plan,
                params.force
              );
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

      return { initialize };
    }),
    accessors: true,
  }
) {}
