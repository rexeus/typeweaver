import fs from "node:fs";
import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../../helpers/path.js";
import { MissingCanonicalResponseError } from "../../plugins/errors/MissingCanonicalResponseError.js";
import { makeEffectContextIO } from "./pluginContextEffectIO.js";
import type { SafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import type {
  NormalizedResponse,
  NormalizedSpec,
} from "../../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginContext,
  TemplateData,
  TypeweaverUserConfig,
} from "../../plugins/contextTypes.js";
import type {
  FileSystem,
  PathSafetyShape,
  TemplateRendererShape,
} from "./pluginContextEffectIO.js";

export {
  livePathSafetyShape,
  liveTemplateRendererShape,
} from "./pluginContextEffectIO.js";
export type {
  PathSafetyShape,
  TemplateRendererShape,
} from "./pluginContextEffectIO.js";

/**
 * Per-call tracker over the set of generated file paths. Each
 * `createGeneratorContext` invocation gets its own tracker so concurrent
 * generation runs cannot observe one another's state.
 *
 * `drainPendingWriteLogs` returns (and clears) the paths written via
 * `writeFile` since the previous drain. The Effect-native orchestrator
 * flushes this queue through `Effect.logInfo` after each plugin's
 * `generate` stage — the sync write callback itself runs outside any
 * Effect runtime, so it cannot log through the configured logger directly.
 */
type GeneratedFilesTracker = {
  readonly add: (filePath: string) => void;
  readonly recordWrite: (filePath: string) => void;
  readonly snapshot: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
};

const createGeneratedFilesTracker = (): GeneratedFilesTracker => {
  const generatedFiles = new Set<string>();
  let pendingWriteLogs: string[] = [];
  return {
    add: filePath => generatedFiles.add(filePath),
    recordWrite: filePath => {
      generatedFiles.add(filePath);
      pendingWriteLogs.push(filePath);
    },
    snapshot: () => Array.from(generatedFiles).sort(),
    drainPendingWriteLogs: () => {
      const drained = pendingWriteLogs;
      pendingWriteLogs = [];
      return drained;
    },
  };
};

type PluginContextBuilderDeps = {
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
  readonly syncAtomicFileSystem?: SyncAtomicFileSystem;
  /**
   * Backs the Effect-native context surface (`writeFileEffect`,
   * `renderTemplateEffect`). Captured at construction time so plugin
   * lifecycle stages keep `R = never` (ADR 0003) while their writes route
   * through the platform `FileSystem` service.
   */
  readonly fileSystem: FileSystem.FileSystem;
};

/**
 * Narrow sync filesystem port for the contractually synchronous plugin writer.
 * It stays internal to `@rexeus/typeweaver-gen`: plugin authors continue to
 * consume only `GeneratorContext.writeFile`.
 */
export type SyncAtomicFileSystem = {
  readonly getExistingFileMode: (absolutePath: string) => number | undefined;
  readonly makeTempDirectory: (prefixPath: string) => string;
  readonly writeFileExclusive: (
    filePath: string,
    content: string,
    mode: number
  ) => void;
  readonly chmod: (filePath: string, mode: number) => void;
  readonly rename: (oldPath: string, newPath: string) => void;
  readonly removeDirectory: (dirPath: string) => void;
};

export const liveSyncAtomicFileSystem: SyncAtomicFileSystem = {
  getExistingFileMode: absolutePath => {
    let pathStats: fs.Stats;
    try {
      pathStats = fs.lstatSync(absolutePath);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      ) {
        return undefined;
      }
      throw error;
    }

    if (!pathStats.isFile()) {
      return undefined;
    }

    return pathStats.mode & 0o777;
  },
  makeTempDirectory: prefixPath => fs.mkdtempSync(prefixPath),
  writeFileExclusive: (filePath, content, mode) =>
    fs.writeFileSync(filePath, content, {
      flag: "wx",
      mode,
    }),
  chmod: (filePath, mode) => fs.chmodSync(filePath, mode),
  rename: (oldPath, newPath) => fs.renameSync(oldPath, newPath),
  removeDirectory: dirPath =>
    fs.rmSync(dirPath, { recursive: true, force: true }),
};

const writeFileViaTempReplaceWith = (
  fileSystem: SyncAtomicFileSystem,
  config: {
    readonly content: string;
    readonly revalidateDestination: () => SafeGeneratedFilePath;
    readonly onCommit: (generatedPath: string) => void;
  }
): void => {
  // Sync twin of `writeFileViaTempReplaceEffect` for the contractually
  // sync plugin-author surface (ADR 0003/0004). Same atomic-replace
  // pattern (mkdtemp + write + chmod preservation + rename).
  // Every plugin write still funnels through
  // `pathSafety.validateGeneratedPath(...)`, so path traversal cannot
  // reach this surface.
  const stagingPath = config.revalidateDestination();
  const existingFileMode = fileSystem.getExistingFileMode(stagingPath.fullPath);
  const destinationDir = path.dirname(stagingPath.fullPath);
  const tempDir = fileSystem.makeTempDirectory(
    path.join(destinationDir, ".typeweaver-")
  );
  const tempFile = path.join(tempDir, "generated.tmp");

  try {
    fileSystem.writeFileExclusive(
      tempFile,
      config.content,
      existingFileMode ?? 0o666
    );

    if (existingFileMode !== undefined) {
      fileSystem.chmod(tempFile, existingFileMode);
    }

    // Re-probe immediately before publication. This rejects ancestor symlink
    // swaps visible at check time and narrows the unavoidable race window of
    // Node's pathname-based rename API.
    const publishPath = config.revalidateDestination();

    // Both operations are synchronous: once rename publishes the destination,
    // record the write before any fallible cleanup can run. A cleanup-only
    // failure may still be reported, but it cannot leave a committed file
    // absent from the generated-file tracker and pending log queue.
    fileSystem.rename(tempFile, publishPath.fullPath);
    config.onCommit(publishPath.generatedPath);
  } catch (operationError) {
    try {
      fileSystem.removeDirectory(tempDir);
    } catch {
      // Preserve the writer's original failure: a cleanup error is secondary
      // and must not erase the rename/write defect callers need to diagnose.
    }
    throw operationError;
  }

  fileSystem.removeDirectory(tempDir);
};

type PluginContextParams = {
  readonly outputDir: string;
  readonly inputDir: string;
  readonly config: TypeweaverUserConfig;
};

type GeneratorContextParams = PluginContextParams & {
  readonly normalizedSpec: NormalizedSpec;
  readonly templateDir: string;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
};

export type PluginContextBuilderApi = {
  readonly createPluginContext: (params: PluginContextParams) => PluginContext;
  readonly createGeneratorContext: (
    params: GeneratorContextParams
  ) => GeneratorContext;
  readonly getGeneratedFiles: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
};

type GeneratorContextDeps = {
  readonly pathSafety: PathSafetyShape;
  readonly templateRenderer: TemplateRendererShape;
  readonly syncAtomicFileSystem: SyncAtomicFileSystem;
  readonly fileSystem: FileSystem.FileSystem;
};

const createPluginContext = (params: PluginContextParams): PluginContext => ({
  outputDir: params.outputDir,
  inputDir: params.inputDir,
  config: params.config,
});

const createCanonicalResponseHelpers = (params: GeneratorContextParams) => {
  const canonicalResponsesByName = new Map<string, NormalizedResponse>(
    params.normalizedSpec.responses.map(response => [response.name, response])
  );
  const getCanonicalResponse = (responseName: string): NormalizedResponse => {
    const response = canonicalResponsesByName.get(responseName);
    if (response === undefined) {
      throw new MissingCanonicalResponseError({ responseName });
    }
    return response;
  };
  const getCanonicalResponseOutputFile = (responseName: string): string =>
    path.join(
      params.responsesOutputDir,
      `${pascalCase(responseName)}Response.ts`
    );
  return { getCanonicalResponse, getCanonicalResponseOutputFile };
};

const createImportPathHelpers = (
  params: GeneratorContextParams,
  getCanonicalResponseOutputFile: (responseName: string) => string
) => ({
  getCanonicalResponseImportPath: (config: {
    readonly importerDir: string;
    readonly responseName: string;
  }): string =>
    relative(
      config.importerDir,
      getCanonicalResponseOutputFile(config.responseName).replace(
        /\.ts$/,
        ".js"
      )
    ),
  getSpecImportPath: (config: { readonly importerDir: string }): string =>
    relative(config.importerDir, path.join(params.specOutputDir, "spec.js")),
});

const getOperationDefinitionAccessor = (config: {
  readonly resourceName: string;
  readonly operationId: string;
}): string =>
  `getOperationDefinition(` +
  `spec, ` +
  `${JSON.stringify(config.resourceName)}, ` +
  `${JSON.stringify(config.operationId)}` +
  `)`;

const makeOperationFileNames = (operationId: string) => {
  const fileBase = pascalCase(operationId);
  return {
    requestFileName: `${fileBase}Request.ts`,
    responseFileName: `${fileBase}Response.ts`,
    requestValidationFileName: `${fileBase}RequestValidator.ts`,
    responseValidationFileName: `${fileBase}ResponseValidator.ts`,
    clientFileName: `${fileBase}Client.ts`,
  };
};

const createOutputPathHelpers = (params: GeneratorContextParams) => {
  const getResourceOutputDir = (resourceName: string): string =>
    path.join(params.outputDir, resourceName);
  const getOperationOutputPaths = (config: {
    readonly resourceName: string;
    readonly operationId: string;
  }) => {
    const outputDir = getResourceOutputDir(config.resourceName);
    const fileNames = makeOperationFileNames(config.operationId);
    return {
      outputDir,
      ...fileNames,
      requestFile: path.join(outputDir, fileNames.requestFileName),
      responseFile: path.join(outputDir, fileNames.responseFileName),
      requestValidationFile: path.join(
        outputDir,
        fileNames.requestValidationFileName
      ),
      responseValidationFile: path.join(
        outputDir,
        fileNames.responseValidationFileName
      ),
      clientFile: path.join(outputDir, fileNames.clientFileName),
    };
  };
  return { getOperationOutputPaths, getResourceOutputDir };
};

const createSyncContextIO = (
  params: GeneratorContextParams,
  deps: GeneratorContextDeps,
  tracker: GeneratedFilesTracker
) => {
  const outputRoot = path.resolve(params.outputDir);
  const validateDestination = (requestedPath: string) =>
    deps.pathSafety.validateGeneratedPath({
      outputDir: outputRoot,
      requestedPath,
    });

  return {
    writeFile: (relativePath: string, content: string): void => {
      const safePath = validateDestination(relativePath);
      fs.mkdirSync(path.dirname(safePath.fullPath), { recursive: true });
      writeFileViaTempReplaceWith(deps.syncAtomicFileSystem, {
        content,
        revalidateDestination: () => validateDestination(relativePath),
        onCommit: generatedPath => tracker.recordWrite(generatedPath),
      });
    },
    renderTemplate: (templatePath: string, data: TemplateData): string => {
      const fullTemplatePath = path.isAbsolute(templatePath)
        ? templatePath
        : path.join(params.templateDir, templatePath);
      const template = fs.readFileSync(fullTemplatePath, "utf8");
      return deps.templateRenderer.render(template, data);
    },
    addGeneratedFile: (relativePath: string): void => {
      const safePath = validateDestination(relativePath);
      tracker.add(safePath.generatedPath);
    },
    getGeneratedFiles: (): string[] => [...tracker.snapshot()],
  };
};

const createEffectContextIO = (
  params: GeneratorContextParams,
  deps: GeneratorContextDeps,
  tracker: GeneratedFilesTracker
) =>
  makeEffectContextIO({
    fileSystem: deps.fileSystem,
    pathSafety: deps.pathSafety,
    templateRenderer: deps.templateRenderer,
    outputDir: params.outputDir,
    templateDir: params.templateDir,
    trackWrite: generatedPath => tracker.recordWrite(generatedPath),
    trackGenerated: generatedPath => tracker.add(generatedPath),
  });

const createGeneratorContext = (
  params: GeneratorContextParams,
  deps: GeneratorContextDeps,
  tracker: GeneratedFilesTracker
): GeneratorContext => {
  const canonicalResponseHelpers = createCanonicalResponseHelpers(params);
  return {
    ...createPluginContext(params),
    normalizedSpec: params.normalizedSpec,
    coreDir: params.coreDir,
    responsesOutputDir: params.responsesOutputDir,
    specOutputDir: params.specOutputDir,
    ...canonicalResponseHelpers,
    ...createImportPathHelpers(
      params,
      canonicalResponseHelpers.getCanonicalResponseOutputFile
    ),
    getOperationDefinitionAccessor,
    ...createOutputPathHelpers(params),
    ...createSyncContextIO(params, deps, tracker),
    ...createEffectContextIO(params, deps, tracker),
  };
};

/**
 * Factory for sync-surface plugin contexts.
 *
 * The `pathSafety` and `templateRenderer` deps are injected so the
 * security-critical path guard and the rendering engine can both be
 * substituted in tests. Production wiring passes `livePathSafetyShape` /
 * `liveTemplateRendererShape` — the same sync cores that back the
 * Effect-native `PathSafety` and `TemplateRenderer` services, with no
 * `Effect.runSync` bridging in between.
 *
 * The sync atomic-replace operations are captured behind
 * `SyncAtomicFileSystem`; production delegates that narrow port to `node:fs`,
 * while tests can inject deterministic rename/cleanup failures. Directory
 * creation and template reads remain direct `node:fs` calls because the
 * plugin-author API is sync end-to-end (ADR 0003/0004). Every write remains
 * gated by `pathSafety.validateGeneratedPath`.
 */
export function createPluginContextBuilder(
  deps: PluginContextBuilderDeps
): PluginContextBuilderApi {
  const tracker = createGeneratedFilesTracker();
  const generatorContextDeps: GeneratorContextDeps = {
    pathSafety: deps.pathSafety,
    templateRenderer: deps.templateRenderer,
    syncAtomicFileSystem: deps.syncAtomicFileSystem ?? liveSyncAtomicFileSystem,
    fileSystem: deps.fileSystem,
  };

  return {
    createPluginContext,
    createGeneratorContext: params =>
      createGeneratorContext(params, generatorContextDeps, tracker),
    getGeneratedFiles: () => tracker.snapshot(),
    drainPendingWriteLogs: () => tracker.drainPendingWriteLogs(),
  };
}
