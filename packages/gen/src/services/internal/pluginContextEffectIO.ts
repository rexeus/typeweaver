import path from "node:path";
import { Effect } from "effect";
import {
  GeneratedPathProbeError,
  TemplateRenderError,
  UnsafeGeneratedPathError,
} from "../../errors/index.js";
import { resolveSafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import { renderTemplate } from "../../helpers/templateEngine.js";
import type { SafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import type { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";

export type { FileSystem } from "@effect/platform";

/**
 * Narrowed PathSafety surface: a sync function that validates a requested
 * generated path against path-traversal/symlink-escape attacks and returns
 * the resolved absolute + project-relative pair. Production wiring uses
 * `livePathSafetyShape`; tests can substitute a pure stand-in. Implementations
 * may throw `UnsafeGeneratedPathError` or `GeneratedPathProbeError`.
 */
export type PathSafetyShape = {
  readonly validateGeneratedPath: (params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }) => SafeGeneratedFilePath;
};

/**
 * Narrowed TemplateRenderer surface. Mirrors `PathSafetyShape`.
 */
export type TemplateRendererShape = {
  readonly render: (template: string, data: unknown) => string;
};

/**
 * Production `PathSafetyShape`: the sync path-traversal guard, shared with
 * the Effect-native `PathSafety` service. Throws `UnsafeGeneratedPathError`
 * for policy violations and `GeneratedPathProbeError` for recognized Node
 * filesystem failures.
 */
export const livePathSafetyShape: PathSafetyShape = {
  validateGeneratedPath: params =>
    resolveSafeGeneratedFilePath(params.outputDir, params.requestedPath),
};

/**
 * Production `TemplateRendererShape`: the sync EJS-like renderer, shared
 * with the Effect-native `TemplateRenderer` service.
 */
export const liveTemplateRendererShape: TemplateRendererShape = {
  render: (template, data) =>
    // Plugin authors pass arbitrary template data; the engine scopes its
    // `with(data)` lookup over a plain record. Non-record values have never
    // been supported — the widening cast preserves the existing contract.
    renderTemplate(template, (data ?? {}) as Record<string, unknown>),
};

/**
 * Lift the sync path-safety guard into the Effect error channel.
 * `UnsafeGeneratedPathError` and `GeneratedPathProbeError` are expected;
 * anything else escapes as a defect, mirroring the `PathSafety` service.
 */
const validateGeneratedPathEffect = (
  pathSafety: PathSafetyShape,
  params: {
    readonly outputDir: string;
    readonly requestedPath: string;
  }
): Effect.Effect<
  SafeGeneratedFilePath,
  GeneratedPathProbeError | UnsafeGeneratedPathError
> =>
  Effect.try({
    try: () => pathSafety.validateGeneratedPath(params),
    catch: error => {
      if (
        error instanceof GeneratedPathProbeError ||
        error instanceof UnsafeGeneratedPathError
      ) {
        return error;
      }
      throw error;
    },
  });

/**
 * Effect-native mode probe mirroring the sync `getExistingFileMode`: a
 * missing target resolves to `undefined` (fresh write), a non-file resolves
 * to `undefined` (no mode to preserve), everything else propagates.
 */
const getExistingFileModeEffect = (
  fileSystem: FileSystem.FileSystem,
  absolutePath: string
): Effect.Effect<number | undefined, PlatformError> =>
  fileSystem.stat(absolutePath).pipe(
    Effect.map(info => (info.type === "File" ? info.mode & 0o777 : undefined)),
    Effect.catchTag("SystemError", error =>
      error.reason === "NotFound"
        ? Effect.as(Effect.void, undefined)
        : Effect.fail(error)
    )
  );

/**
 * Effect-native counterpart of the sync `writeFileViaTempReplace`: same
 * atomic-replace pattern (temp dir next to the destination, write, chmod
 * preservation, rename) expressed over the `FileSystem` service. The temp
 * dir is scoped, so it is removed even when the write or rename fails or
 * the fiber is interrupted.
 */
const writeFileViaTempReplaceEffect = (
  fileSystem: FileSystem.FileSystem,
  safePath: SafeGeneratedFilePath,
  content: string,
  trackWrite: (generatedPath: string) => void
): Effect.Effect<void, PlatformError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const destinationDir = path.dirname(safePath.fullPath);
      const existingFileMode = yield* getExistingFileModeEffect(
        fileSystem,
        safePath.fullPath
      );
      yield* fileSystem.makeDirectory(destinationDir, { recursive: true });
      const tempDir = yield* fileSystem.makeTempDirectoryScoped({
        directory: destinationDir,
        prefix: ".typeweaver-",
      });
      const tempFile = path.join(tempDir, "generated.tmp");
      yield* fileSystem.writeFileString(tempFile, content);
      if (existingFileMode !== undefined) {
        yield* fileSystem.chmod(tempFile, existingFileMode);
      }
      yield* Effect.uninterruptible(
        fileSystem.rename(tempFile, safePath.fullPath).pipe(
          Effect.tap(() =>
            // Rename publishes the new file. Tracking belongs to the same
            // commit section so interruption cannot expose an untracked file.
            Effect.sync(() => trackWrite(safePath.generatedPath))
          )
        )
      );
    })
  );

/**
 * The Effect-native slice of the `GeneratorContext` surface. Same
 * guarantees as the sync helpers — path-traversal guard, atomic replace,
 * mode preservation, tracker registration — expressed over the platform
 * `FileSystem` service with closed typed error channels.
 */
export type EffectContextIO = {
  readonly writeFileEffect: (
    relativePath: string,
    content: string
  ) => Effect.Effect<
    void,
    GeneratedPathProbeError | UnsafeGeneratedPathError | PlatformError
  >;
  readonly renderTemplateEffect: (
    templatePath: string,
    data: unknown
  ) => Effect.Effect<string, TemplateRenderError | PlatformError>;
  readonly addGeneratedFileEffect: (
    relativePath: string
  ) => Effect.Effect<void, GeneratedPathProbeError | UnsafeGeneratedPathError>;
};

/**
 * Builds the Effect-native context methods for one generator-context
 * instance. The `FileSystem` is captured here (construction time), so
 * plugin lifecycle stages keep `R = never` (ADR 0003). Tracking callbacks
 * route into the same per-call tracker the sync helpers use — mixing both
 * surfaces in one plugin is safe.
 */
export const makeEffectContextIO = (config: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
  readonly outputDir: string;
  readonly templateDir: string;
  readonly trackWrite: (generatedPath: string) => void;
  readonly trackGenerated: (generatedPath: string) => void;
}): EffectContextIO => ({
  writeFileEffect: (relativePath, content) =>
    validateGeneratedPathEffect(config.pathSafety, {
      outputDir: config.outputDir,
      requestedPath: relativePath,
    }).pipe(
      Effect.flatMap(safePath =>
        writeFileViaTempReplaceEffect(
          config.fileSystem,
          safePath,
          content,
          config.trackWrite
        )
      )
    ),

  renderTemplateEffect: (templatePath, data) =>
    Effect.gen(function* () {
      const fullTemplatePath = path.isAbsolute(templatePath)
        ? templatePath
        : path.join(config.templateDir, templatePath);

      const template =
        yield* config.fileSystem.readFileString(fullTemplatePath);

      return yield* Effect.try({
        try: () => config.templateRenderer.render(template, data),
        catch: cause => new TemplateRenderError({ cause }),
      });
    }),

  addGeneratedFileEffect: relativePath =>
    validateGeneratedPathEffect(config.pathSafety, {
      outputDir: config.outputDir,
      requestedPath: relativePath,
    }).pipe(
      Effect.map(safePath => {
        config.trackGenerated(safePath.generatedPath);
      })
    ),
});
