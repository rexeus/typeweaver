import path from "node:path";
import { FileSystem } from "@effect/platform";
import { Effect, Exit } from "effect";
import {
  InvalidPluginScaffoldNameError,
  PluginScaffoldFileSystemError,
  PluginScaffoldTargetExistsError,
} from "../errors/PluginScaffoldError.js";
import type { PluginScaffoldFileSystemOperation } from "../errors/PluginScaffoldError.js";
import type { PlatformError } from "@effect/platform/Error";

const PLUGIN_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

const TEMPLATE_FILES = [
  { template: "gitignore.tmpl", output: ".gitignore" },
  { template: "package.json.tmpl", output: "package.json" },
  { template: "README.md.tmpl", output: "README.md" },
  {
    template: "src/configurablePlugin.ts.tmpl",
    output: "src/configurablePlugin.ts",
  },
  { template: "src/index.ts.tmpl", output: "src/index.ts" },
  { template: "src/plugin.ts.tmpl", output: "src/plugin.ts" },
  {
    template: "test/fixture/spec.ts.tmpl",
    output: "test/fixture/spec.ts",
  },
  { template: "test/plugin.test.ts.tmpl", output: "test/plugin.test.ts" },
  { template: "tsconfig.build.json.tmpl", output: "tsconfig.build.json" },
  { template: "tsconfig.json.tmpl", output: "tsconfig.json" },
] as const;

export type PluginScaffoldParams = {
  readonly pluginName: string;
  readonly targetDir: string;
  readonly currentWorkingDirectory: string;
  readonly templateDir: string;
  readonly typeweaverVersion: string;
};

export type PluginScaffoldResult = {
  readonly targetDir: string;
  readonly files: readonly string[];
};

type PlannedPluginScaffoldFile = {
  readonly path: string;
  readonly content: string;
};

type PluginScaffoldFailure =
  | InvalidPluginScaffoldNameError
  | PluginScaffoldFileSystemError
  | PluginScaffoldTargetExistsError;

const toIdentifierParts = (pluginName: string): readonly string[] =>
  pluginName.split("-");

const toPluginIdentifier = (pluginName: string): string => {
  const [first = "", ...remaining] = toIdentifierParts(pluginName);
  return [
    first,
    ...remaining.map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`),
  ].join("");
};

const toPluginTypeName = (pluginName: string): string =>
  toIdentifierParts(pluginName)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

const renderTemplate = (
  template: string,
  params: Pick<PluginScaffoldParams, "pluginName" | "typeweaverVersion">
): string => {
  const packageName = `typeweaver-plugin-${params.pluginName}`;
  return template
    .replaceAll("{{packageName}}", packageName)
    .replaceAll("{{pluginIdentifier}}", toPluginIdentifier(params.pluginName))
    .replaceAll("{{pluginName}}", params.pluginName)
    .replaceAll("{{pluginTypeName}}", toPluginTypeName(params.pluginName))
    .replaceAll("{{typeweaverVersion}}", params.typeweaverVersion);
};

const fileSystemError =
  (operation: PluginScaffoldFileSystemOperation, targetPath: string) =>
  (cause: PlatformError): PluginScaffoldFileSystemError =>
    new PluginScaffoldFileSystemError({
      operation,
      path: targetPath,
      cause,
    });

const planScaffold = (
  fileSystem: FileSystem.FileSystem,
  params: PluginScaffoldParams
): Effect.Effect<
  readonly PlannedPluginScaffoldFile[],
  PluginScaffoldFileSystemError
> =>
  Effect.forEach(
    TEMPLATE_FILES,
    entry => {
      const templatePath = path.join(params.templateDir, entry.template);
      return fileSystem.readFileString(templatePath).pipe(
        Effect.mapError(fileSystemError("readTemplate", templatePath)),
        Effect.map(template => ({
          path: entry.output,
          content: renderTemplate(template, params),
        }))
      );
    },
    { concurrency: 1 }
  );

const mapTargetCreationError = (
  targetDir: string,
  cause: PlatformError
): PluginScaffoldFileSystemError | PluginScaffoldTargetExistsError =>
  cause._tag === "SystemError" && cause.reason === "AlreadyExists"
    ? new PluginScaffoldTargetExistsError({ targetDir })
    : fileSystemError("makeDirectory", targetDir)(cause);

const writeScaffoldFile = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  file: PlannedPluginScaffoldFile
): Effect.Effect<void, PluginScaffoldFileSystemError> => {
  const filePath = path.join(targetDir, file.path);
  const directory = path.dirname(filePath);
  return fileSystem
    .makeDirectory(directory, { recursive: true })
    .pipe(
      Effect.mapError(fileSystemError("makeDirectory", directory)),
      Effect.zipRight(
        fileSystem
          .writeFileString(filePath, file.content, { flag: "wx" })
          .pipe(Effect.mapError(fileSystemError("writeFile", filePath)))
      )
    );
};

const publishScaffold = (
  fileSystem: FileSystem.FileSystem,
  targetDir: string,
  plan: readonly PlannedPluginScaffoldFile[]
): Effect.Effect<
  void,
  PluginScaffoldFileSystemError | PluginScaffoldTargetExistsError
> => {
  let ownsTarget = false;
  let complete = false;

  return Effect.gen(function* () {
    const parentDir = path.dirname(targetDir);
    yield* fileSystem
      .makeDirectory(parentDir, { recursive: true })
      .pipe(Effect.mapError(fileSystemError("makeDirectory", parentDir)));
    yield* Effect.uninterruptible(
      fileSystem.makeDirectory(targetDir).pipe(
        Effect.mapError(cause => mapTargetCreationError(targetDir, cause)),
        Effect.tap(() =>
          Effect.sync(() => {
            ownsTarget = true;
          })
        )
      )
    );
    yield* Effect.forEach(
      plan,
      file => writeScaffoldFile(fileSystem, targetDir, file),
      { discard: true, concurrency: 1 }
    );
    yield* Effect.sync(() => {
      complete = true;
    });
  }).pipe(
    Effect.onExit(exit =>
      ownsTarget && (!complete || Exit.isFailure(exit))
        ? fileSystem
            .remove(targetDir, { recursive: true, force: true })
            .pipe(Effect.orDie)
        : Effect.void
    )
  );
};

export class PluginScaffolder extends Effect.Service<PluginScaffolder>()(
  "typeweaver/PluginScaffolder",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const scaffold: (
        params: PluginScaffoldParams
      ) => Effect.Effect<PluginScaffoldResult, PluginScaffoldFailure> =
        Effect.fn("typeweaver.PluginScaffolder.scaffold")(function* (
          params: PluginScaffoldParams
        ) {
          if (!PLUGIN_NAME_PATTERN.test(params.pluginName)) {
            return yield* new InvalidPluginScaffoldNameError({
              pluginName: params.pluginName,
            });
          }

          const targetDir = path.resolve(
            params.currentWorkingDirectory,
            params.targetDir
          );
          const targetExists = yield* fileSystem
            .exists(targetDir)
            .pipe(Effect.mapError(fileSystemError("exists", targetDir)));
          if (targetExists) {
            return yield* new PluginScaffoldTargetExistsError({ targetDir });
          }

          const plan = yield* planScaffold(fileSystem, params);
          yield* publishScaffold(fileSystem, targetDir, plan);

          return {
            targetDir,
            files: plan.map(file => file.path),
          };
        });

      return { scaffold } as const;
    }),
    accessors: true,
  }
) {}
