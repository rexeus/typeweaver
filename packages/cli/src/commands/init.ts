import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import {
  createPackageJsonTemplateFile,
  PACKAGE_JSON_FILE,
} from "../templates/packageJsonTemplate.js";
import {
  STARTER_SPEC_ENTRYPOINT,
  STARTER_TEMPLATE,
} from "../templates/starterTemplate.js";
import {
  createTypeweaverConfigTemplateFile,
  DEFAULT_CONFIG_FORMAT,
  SUPPORTED_CONFIG_FORMATS,
} from "../templates/typeweaverConfigTemplate.js";
import { createCommandLogger, resolvePluginList } from "./shared.js";
import type { GenerationSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import type { TypeweaverConfigFormat } from "../templates/typeweaverConfigTemplate.js";
import type { SharedCommandOptions } from "./shared.js";

const DEFAULT_GENERATED_OUTPUT_DIR = "generated";
const STARTER_ZOD_VERSION = "^4.3.6";

const CLI_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PACKAGE_JSON_PATH = path.join(CLI_MODULE_DIR, "../../package.json");

const getTypeweaverVersion = (): string => {
  const packageJson = JSON.parse(
    fs.readFileSync(CLI_PACKAGE_JSON_PATH, "utf-8")
  ) as { readonly version: string };

  return packageJson.version;
};

export type InitCommandOptions = SharedCommandOptions & {
  readonly output?: string;
  readonly plugins?: string;
  readonly force?: boolean;
  readonly configFormat?: string;
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
  const template = STARTER_TEMPLATE;
  const plugins = resolvePluginList(options.plugins) ?? [];
  const outputDir = options.output ?? DEFAULT_GENERATED_OUTPUT_DIR;

  try {
    const configFormat = resolveConfigFormat(options.configFormat);
    const configFile = createTypeweaverConfigTemplateFile({
      inputPath: STARTER_SPEC_ENTRYPOINT,
      outputPath: outputDir,
      plugins,
      format: configFormat,
    });
    const configPath = path.join(execDir, configFile.relativePath);
    const packageJsonPath = path.join(execDir, PACKAGE_JSON_FILE);
    const shouldCreatePackageJson = !fs.existsSync(packageJsonPath);
    const packageJsonFile = shouldCreatePackageJson
      ? createPackageJsonTemplateFile({
          typeweaverVersion: getTypeweaverVersion(),
          zodVersion: STARTER_ZOD_VERSION,
        })
      : undefined;

    const filesToWrite = [
      ...template.files.map(file => ({
        absolutePath: path.join(execDir, file.relativePath),
        content: file.content,
      })),
      {
        absolutePath: configPath,
        content: configFile.content,
      },
      ...(packageJsonFile
        ? [
            {
              absolutePath: packageJsonPath,
              content: packageJsonFile.content,
            },
          ]
        : []),
    ];

    assertWritableTargets(
      execDir,
      filesToWrite.map(file => file.absolutePath),
      options.force ?? false
    );

    writeFilesAtomically(filesToWrite);

    logger.success("Created a Typeweaver starter project.");
    if (shouldCreatePackageJson) {
      logger.info("Install dependencies: npm install");
    } else {
      logger.info(
        "Install dependencies: npm install @rexeus/typeweaver-core zod"
      );
    }
    logger.info(
      `Validate it with: typeweaver validate --config ./${configFile.relativePath}`
    );
    logger.info(
      `Generate output with: typeweaver generate --config ./${configFile.relativePath}`
    );

    const summary: GenerationSummary = {
      mode: "init",
      dryRun: false,
      targetOutputDir: outputDir,
      targetConfigPath: configPath,
      resourceCount: template.resourceCount,
      operationCount: template.operationCount,
      responseCount: template.responseCount,
      pluginCount: plugins.length,
      generatedFiles: filesToWrite.map(file =>
        path.relative(execDir, file.absolutePath)
      ),
      warnings: [],
    };

    logger.summary(summary);
    return summary;
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
  }
};

type FileToWrite = {
  readonly absolutePath: string;
  readonly content: string;
};

const writeFilesAtomically = (files: readonly FileToWrite[]): void => {
  const snapshots = new Map<string, string | null>();

  for (const file of files) {
    snapshots.set(
      file.absolutePath,
      fs.existsSync(file.absolutePath)
        ? fs.readFileSync(file.absolutePath, "utf-8")
        : null
    );
  }

  try {
    for (const file of files) {
      fs.mkdirSync(path.dirname(file.absolutePath), { recursive: true });
      fs.writeFileSync(file.absolutePath, file.content, "utf-8");
    }
  } catch (error) {
    rollbackFiles(snapshots);
    throw error;
  }
};

const rollbackFiles = (snapshots: ReadonlyMap<string, string | null>): void => {
  for (const [absolutePath, originalContent] of snapshots) {
    if (originalContent === null) {
      if (fs.existsSync(absolutePath)) {
        fs.rmSync(absolutePath, { force: true });
      }
      continue;
    }

    fs.writeFileSync(absolutePath, originalContent, "utf-8");
  }
};

const resolveConfigFormat = (
  requestedFormat: string | undefined
): TypeweaverConfigFormat => {
  if (requestedFormat === undefined) {
    return DEFAULT_CONFIG_FORMAT;
  }

  if (!isSupportedConfigFormat(requestedFormat)) {
    throw new Error(
      `Unsupported config format '${requestedFormat}'. Supported: ${SUPPORTED_CONFIG_FORMATS.join(", ")}.`
    );
  }

  return requestedFormat;
};

const isSupportedConfigFormat = (
  value: string
): value is TypeweaverConfigFormat => {
  return (SUPPORTED_CONFIG_FORMATS as readonly string[]).includes(value);
};

const assertWritableTargets = (
  execDir: string,
  targetPaths: readonly string[],
  isForceEnabled: boolean
): void => {
  if (isForceEnabled) {
    return;
  }

  const existingFile = targetPaths.find(targetPath =>
    fs.existsSync(targetPath)
  );

  if (existingFile) {
    throw new Error(
      `Refusing to overwrite '${existingFile}'. Re-run with --force to replace existing starter files.`
    );
  }

  const starterSpecDirectory = path.join(
    execDir,
    path.dirname(STARTER_SPEC_ENTRYPOINT)
  );

  if (fs.existsSync(starterSpecDirectory)) {
    throw new Error(
      `Refusing to write into existing '${starterSpecDirectory}' directory. Re-run with --force to replace its contents.`
    );
  }
};
