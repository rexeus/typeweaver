import fs from "node:fs";
import path from "node:path";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import type { GenerationSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import {
  STARTER_SPEC_ENTRYPOINT,
  createStarterTemplate,
} from "../templates/starterTemplate.js";
import {
  createTypeweaverConfigTemplateFile,
  TYPEWEAVER_CONFIG_FILE,
} from "../templates/typeweaverConfigTemplate.js";
import {
  createCommandLogger,
  resolvePluginList,
  type SharedCommandOptions,
} from "./shared.js";

const DEFAULT_GENERATED_OUTPUT_DIR = "generated";

export type InitCommandOptions = SharedCommandOptions & {
  readonly output?: string;
  readonly plugins?: string;
  readonly force?: boolean;
};

export type InitCommandContext = {
  readonly execDir?: string;
  readonly createLogger?: (options: InitCommandOptions) => Logger;
};

export const handleInitCommand = async (
  options: InitCommandOptions,
  context: InitCommandContext = {}
): Promise<GenerationSummary | void> => {
  const execDir = context.execDir ?? process.cwd();
  const logger = (context.createLogger ?? createCommandLogger)(options);
  const template = createStarterTemplate();
  const plugins = resolvePluginList(options.plugins) ?? [];
  const outputDir = options.output ?? DEFAULT_GENERATED_OUTPUT_DIR;
  const configFile = createTypeweaverConfigTemplateFile({
    inputPath: STARTER_SPEC_ENTRYPOINT,
    outputPath: outputDir,
    plugins,
  });
  const configPath = path.join(execDir, configFile.relativePath);

  try {
    const filesToWrite = [
      ...template.files.map(file => ({
        absolutePath: path.join(execDir, file.relativePath),
        content: file.content,
      })),
      {
        absolutePath: configPath,
        content: configFile.content,
      },
    ];

    assertWritableTargets(
      execDir,
      filesToWrite.map(file => file.absolutePath),
      options.force ?? false
    );

    for (const file of filesToWrite) {
      fs.mkdirSync(path.dirname(file.absolutePath), { recursive: true });
      fs.writeFileSync(file.absolutePath, file.content, "utf-8");
    }

    logger.success("Created a Typeweaver starter project.");
    logger.info(`Validate it with: typeweaver validate --config ./${TYPEWEAVER_CONFIG_FILE}`);
    logger.info(`Generate output with: typeweaver generate --config ./${TYPEWEAVER_CONFIG_FILE}`);

    const summary: GenerationSummary = {
      mode: "init",
      dryRun: false,
      targetOutputDir: outputDir,
      targetConfigPath: configPath,
      resourceCount: template.resourceCount,
      operationCount: template.operationCount,
      responseCount: template.responseCount,
      pluginCount: plugins.length,
      generatedFiles: filesToWrite.map(file => path.relative(execDir, file.absolutePath)),
      warnings: [],
    };

    logger.summary(summary);
    return summary;
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
  }
};

const assertWritableTargets = (
  execDir: string,
  targetPaths: readonly string[],
  isForceEnabled: boolean
): void => {
  if (isForceEnabled) {
    return;
  }

  const starterRootDirectory = path.join(execDir, path.dirname(STARTER_SPEC_ENTRYPOINT));
  const existingTarget = [starterRootDirectory, ...targetPaths].find(targetPath =>
    fs.existsSync(targetPath)
  );

  if (existingTarget) {
    throw new Error(
      `Refusing to overwrite '${existingTarget}'. Re-run with --force to replace existing starter files.`
    );
  }
};
