import path from "node:path";
import { Effect, FileSystem } from "effect";
import {
  InitTargetNotDirectoryError,
  InitTargetNotEmptyError,
  InvalidInitPackageError,
} from "../errors/ProjectInitError.js";
import { fileSystemError } from "./internal/projectPublishing.js";
import type {
  ProjectInitFailure,
  ProjectInitFileSystemError,
} from "../errors/ProjectInitError.js";
import type { PlannedInitFile } from "./internal/projectPublishing.js";
import type {
  InitConfigFormat,
  InitializeProjectParams,
} from "./ProjectInitializer.js";

export type TargetPreflight = {
  readonly targetExists: boolean;
  readonly packageExists: boolean;
  readonly packageType?: string;
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
] as const;

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
      const packageType: unknown = Reflect.get(parsed, "type");
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

export const inspectTarget = (
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
    if (!packageExists) return { targetExists, packageExists: false };

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

export const planProject = (
  fileSystem: FileSystem.FileSystem,
  params: InitializeProjectParams,
  preflight: TargetPreflight
): Effect.Effect<
  { readonly configFile: string; readonly plan: readonly PlannedInitFile[] },
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

export const findOverwrittenFiles = (
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

export const nextStepsFor = (
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
