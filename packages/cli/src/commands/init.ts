import fs from "node:fs";
import path from "node:path";
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
import { getCliVersion } from "../version.js";
import { createCommandLogger, resolvePluginList } from "./shared.js";
import type { InitSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import type { TypeweaverConfigFormat } from "../templates/typeweaverConfigTemplate.js";
import type { SharedCommandOptions } from "./shared.js";

const DEFAULT_GENERATED_OUTPUT_DIR = "generated";
const STARTER_ZOD_VERSION = "^4.3.6";

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
): Promise<InitSummary | void> => {
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
          typeweaverVersion: getCliVersion(),
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

    const summary: InitSummary = {
      mode: "init",
      targetOutputDir: outputDir,
      targetConfigPath: configPath,
      resourceCount: template.resourceCount,
      operationCount: template.operationCount,
      responseCount: template.responseCount,
      pluginCount: plugins.length,
      generatedFiles: filesToWrite.map(file =>
        path.relative(execDir, file.absolutePath)
      ),
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
  const createdDirectories: string[] = [];

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
      createdDirectories.push(
        ...ensureDirectoryTree(path.dirname(file.absolutePath))
      );
      fs.writeFileSync(file.absolutePath, file.content, "utf-8");
    }
  } catch (error) {
    rollbackFiles(snapshots);
    removeCreatedDirectories(createdDirectories);
    throw error;
  }
};

// Returns every directory that had to be created, deepest first, so rollback
// can remove them in reverse without ever touching pre-existing ancestors.
const ensureDirectoryTree = (targetDirectory: string): readonly string[] => {
  const missing: string[] = [];
  let current = targetDirectory;
  while (!fs.existsSync(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  fs.mkdirSync(targetDirectory, { recursive: true });
  return missing;
};

// Rollback is best-effort on purpose: a failing rollback must never mask the
// original write error that triggered it. Each file is attempted in isolation
// so one unrecoverable path doesn't skip the rest.
const rollbackFiles = (snapshots: ReadonlyMap<string, string | null>): void => {
  for (const [absolutePath, originalContent] of snapshots) {
    try {
      if (originalContent === null) {
        if (fs.existsSync(absolutePath)) {
          fs.rmSync(absolutePath, { force: true });
        }
        continue;
      }

      fs.writeFileSync(absolutePath, originalContent, "utf-8");
    } catch {
      // Swallow: the original write error is the signal the caller needs.
    }
  }
};

// Walk deepest-first and drop directories that are still empty; a directory
// that picked up an unrelated file in the meantime is left alone. Failures are
// swallowed for the same reason as rollbackFiles. Deduplicating by path is
// needed because multiple files can share the same ancestor; sorting by
// segment count is a strictly correct "deeper first" ordering regardless of
// how the paths were collected.
const removeCreatedDirectories = (directories: readonly string[]): void => {
  const uniqueDirectories = [...new Set(directories)].sort(
    (left, right) => right.split(path.sep).length - left.split(path.sep).length
  );

  for (const directory of uniqueDirectories) {
    try {
      if (fs.existsSync(directory) && fs.readdirSync(directory).length === 0) {
        fs.rmdirSync(directory);
      }
    } catch {
      // Swallow: the original write error is the signal the caller needs.
    }
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
