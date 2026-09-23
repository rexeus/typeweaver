import path from "node:path";
import { pascalCase } from "polycase";
import { relative } from "../../helpers/path.js";
import { MissingCanonicalResponseError } from "../../plugins/errors/MissingCanonicalResponseError.js";
import {
  createGeneratedFilesTracker,
  liveSyncAtomicFileSystem,
} from "./pluginContextFileWriter.js";
import {
  createEffectContextIO,
  createSyncContextIO,
} from "./pluginContextIO.js";
import type { NormalizedResponse } from "../../NormalizedSpec.js";
import type {
  GeneratorContext,
  PluginContext,
} from "../../plugins/contextTypes.js";
import type {
  GeneratorContextDeps,
  GeneratorContextParams,
  PluginContextBuilderDeps,
  PluginContextParams,
} from "./pluginContextBuilderTypes.js";
import type {
  GeneratedFilesTracker,
  SyncAtomicFileSystem,
} from "./pluginContextFileWriter.js";

export type {
  GeneratorContextDeps,
  GeneratorContextParams,
  PluginContextParams,
};
export type { SyncAtomicFileSystem };
export { liveSyncAtomicFileSystem };

export type PluginContextBuilderApi = {
  readonly createPluginContext: (params: PluginContextParams) => PluginContext;
  readonly createGeneratorContext: (
    params: GeneratorContextParams
  ) => GeneratorContext;
  readonly getGeneratedFiles: () => readonly string[];
  readonly drainPendingWriteLogs: () => readonly string[];
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
