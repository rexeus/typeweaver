import path from "node:path";
import { Effect } from "effect";
import { TemplateRenderError } from "../../errors/TemplateRenderError.js";
import { UnsafeGeneratedPathError } from "../../errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../../helpers/pathSafety.js";
import { renderTemplate } from "../../helpers/templateEngine.js";
import {
  canonicalResponseFile,
  canonicalResponseImportPath,
  findCanonicalResponse,
  makeOperationOutputPaths,
  specImportPath,
} from "./pluginTestContextPaths.js";
import type { GeneratedPathProbeError } from "../../errors/GeneratedPathProbeError.js";
import type { NormalizedSpec } from "../../NormalizedSpec.js";
import type {
  GeneratorContext,
  TemplateData,
  TypeweaverUserConfig,
} from "../../plugins/contextTypes.js";

export type PluginTestContextOptions = {
  readonly inputDir: string;
  readonly outputDir: string;
  readonly templateDir: string;
  readonly coreDir: string;
  readonly responsesOutputDir: string;
  readonly specOutputDir: string;
  readonly config: TypeweaverUserConfig;
};

export type PluginTestContextState = {
  readonly fileContent: Map<string, string>;
  readonly generatedFiles: Set<string>;
};

const safeGeneratedPath = (outputDir: string, requestedPath: string): string =>
  resolveSafeGeneratedFilePath(outputDir, requestedPath, {
    lstat: () => undefined,
  }).generatedPath;

const templateKey = (templateDir: string, templatePath: string): string =>
  path.isAbsolute(templatePath)
    ? path.relative(templateDir, templatePath).split(path.sep).join("/")
    : templatePath.replaceAll("\\", "/");

const readTemplate = (
  templates: ReadonlyMap<string, string>,
  templateDir: string,
  templatePath: string
): string => {
  const key = path.posix.normalize(templateKey(templateDir, templatePath));
  const template = templates.get(key);
  if (template === undefined) {
    throw new Error(`Plugin test template '${key}' was not provided`);
  }
  return template;
};

const effectFromSync = <A>(
  operation: () => A
): Effect.Effect<A, GeneratedPathProbeError | UnsafeGeneratedPathError> =>
  Effect.suspend(() => {
    try {
      return Effect.succeed(operation());
    } catch (cause) {
      return cause instanceof UnsafeGeneratedPathError
        ? Effect.fail(cause)
        : Effect.die(cause);
    }
  });

export const makePluginTestGeneratorContext = (params: {
  readonly options: PluginTestContextOptions;
  readonly normalizedSpec: NormalizedSpec;
  readonly templates: ReadonlyMap<string, string>;
  readonly state: PluginTestContextState;
}): GeneratorContext => {
  const { options, normalizedSpec, state } = params;
  const writeFile = (filePath: string, content: string): void => {
    const generatedPath = safeGeneratedPath(options.outputDir, filePath);
    state.fileContent.set(generatedPath, content);
    state.generatedFiles.add(generatedPath);
  };
  const addGeneratedFile = (filePath: string): void => {
    state.generatedFiles.add(safeGeneratedPath(options.outputDir, filePath));
  };
  const render = (templatePath: string, data: TemplateData): string =>
    renderTemplate(
      readTemplate(params.templates, options.templateDir, templatePath),
      data
    );

  return {
    outputDir: options.outputDir,
    inputDir: options.inputDir,
    config: options.config,
    normalizedSpec,
    coreDir: options.coreDir,
    responsesOutputDir: options.responsesOutputDir,
    specOutputDir: options.specOutputDir,
    getCanonicalResponse: responseName =>
      findCanonicalResponse(normalizedSpec, responseName),
    getCanonicalResponseOutputFile: responseName =>
      canonicalResponseFile(options.responsesOutputDir, responseName),
    getCanonicalResponseImportPath: config =>
      canonicalResponseImportPath({
        ...config,
        responsesOutputDir: options.responsesOutputDir,
      }),
    getSpecImportPath: config =>
      specImportPath(config.importerDir, options.specOutputDir),
    getOperationDefinitionAccessor: config =>
      `getOperationDefinition(spec, ${JSON.stringify(config.resourceName)}, ${JSON.stringify(config.operationId)})`,
    getOperationOutputPaths: config =>
      makeOperationOutputPaths(
        options.outputDir,
        config.resourceName,
        config.operationId
      ),
    getResourceOutputDir: resourceName =>
      path.join(options.outputDir, resourceName),
    writeFile,
    renderTemplate: render,
    addGeneratedFile,
    getGeneratedFiles: () => Array.from(state.generatedFiles).sort(),
    writeFileEffect: (filePath, content) =>
      effectFromSync(() => writeFile(filePath, content)),
    renderTemplateEffect: (templatePath, data) =>
      Effect.try({
        try: () => render(templatePath, data),
        catch: cause => new TemplateRenderError({ cause }),
      }),
    addGeneratedFileEffect: filePath =>
      effectFromSync(() => addGeneratedFile(filePath)),
  };
};
