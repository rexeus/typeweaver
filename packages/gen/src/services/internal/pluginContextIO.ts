import fs from "node:fs";
import path from "node:path";
import { makeEffectContextIO } from "./pluginContextEffectIO.js";
import { writeFileViaTempReplaceWith } from "./pluginContextFileWriter.js";
import type {
  GeneratorContextParams,
  GeneratorContextDeps,
} from "./pluginContextBuilderTypes.js";
import type { GeneratedFilesTracker } from "./pluginContextFileWriter.js";

export const createSyncContextIO = (
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
    renderTemplate: (
      templatePath: string,
      data: Parameters<GeneratorContextDeps["templateRenderer"]["render"]>[1]
    ): string => {
      const fullTemplatePath = path.isAbsolute(templatePath)
        ? templatePath
        : path.join(params.templateDir, templatePath);
      return deps.templateRenderer.render(
        fs.readFileSync(fullTemplatePath, "utf8"),
        data
      );
    },
    addGeneratedFile: (relativePath: string): void =>
      tracker.add(validateDestination(relativePath).generatedPath),
    getGeneratedFiles: (): string[] => [...tracker.snapshot()],
  };
};
export const createEffectContextIO = (
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
