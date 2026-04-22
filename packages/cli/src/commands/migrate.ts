import fs from "node:fs";
import path from "node:path";
import { writeDiagnostic } from "../diagnosticFormatter.js";
import { createCommandLogger } from "./shared.js";
import type { MigrateSummary } from "../generationResult.js";
import type { Logger } from "../logger.js";
import type { SharedCommandOptions } from "./shared.js";

type MigrationGuide = {
  readonly heading: string;
  readonly summary: string;
  readonly steps: readonly string[];
};

const MIGRATION_GUIDE_07: MigrationGuide = {
  heading: "0.7.x → 0.8.x",
  summary:
    "Response classes became typed plain objects with factory helpers and discriminated unions.",
  steps: [
    "Regenerate output before updating application code.",
    "Replace `new XxxResponse(...)` with `createXxxResponse(...)`.",
    'Replace `instanceof` response checks with `response.type === "XxxName"`.',
    "Update client error handling to inspect returned response unions instead of catching typed response classes.",
    "Update imports so shared/generated responses come from the centralized `responses/` output directory.",
  ],
};

const MIGRATION_GUIDE_08: MigrationGuide = {
  heading: "0.8.x → 0.9.x",
  summary:
    "The CLI now expects a functional `defineSpec()` entrypoint instead of directory scanning.",
  steps: [
    "Rename `definition/` to `spec/` if you want to follow the recommended structure.",
    "Replace `new HttpOperationDefinition({...})` with `defineOperation({...})`.",
    "Replace `new HttpResponseDefinition({...})` with `defineResponse({...})`.",
    "Replace `ResponseDefinition.extend({...})` with `defineDerivedResponse(...)` or a standalone `defineResponse({...})`.",
    "Create a `spec/index.ts` entrypoint that exports `defineSpec({ resources: {...} })`.",
    "Update CLI/config usage so `input` points to a single spec entrypoint file and remove any `shared` setting.",
    "Regenerate output and verify no old definition-class imports remain.",
  ],
};

export type MigrateCommandOptions = SharedCommandOptions & {
  readonly from?: string;
};

export type MigrateCommandContext = {
  readonly execDir?: string;
  readonly createLogger?: (options: MigrateCommandOptions) => Logger;
};

export const handleMigrateCommand = async (
  options: MigrateCommandOptions,
  context: MigrateCommandContext = {}
): Promise<MigrateSummary | void> => {
  const execDir = context.execDir ?? process.cwd();
  const logger = (context.createLogger ?? createCommandLogger)(options);

  try {
    const detectedVersion =
      options.from ?? detectInstalledTypeweaverVersion(execDir);

    if (!detectedVersion) {
      throw new Error(
        "Could not detect an installed Typeweaver version from package.json. Pass --from <version> to show the right migration guidance."
      );
    }

    const guides = getMigrationGuides(detectedVersion);

    if (guides.length === 0) {
      logger.success(
        `No bundled migration guidance is needed for ${detectedVersion}. You're already on the functional spec API line.`
      );

      const summary: MigrateSummary = {
        mode: "migrate",
        detectedVersion,
        advisoryCount: 0,
      };

      logger.summary(summary);
      return summary;
    }

    logger.step(`Migration guidance for ${detectedVersion}`);

    for (const guide of guides) {
      logger.info("");
      logger.info(guide.heading);
      logger.info(guide.summary);

      for (const [index, step] of guide.steps.entries()) {
        logger.info(`  ${index + 1}. ${step}`);
      }
    }

    logger.info("");
    logger.info(
      "For the full rationale and examples, see MIGRATION.md in the repository."
    );

    const summary: MigrateSummary = {
      mode: "migrate",
      detectedVersion,
      advisoryCount: guides.reduce(
        (count, guide) => count + guide.steps.length,
        0
      ),
    };

    logger.summary(summary);
    return summary;
  } catch (error) {
    writeDiagnostic(logger, error);
    process.exitCode = 1;
  }
};

export const detectInstalledTypeweaverVersion = (
  execDir: string
): string | undefined => {
  const packageJsonPath = path.join(execDir, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return undefined;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
    readonly peerDependencies?: Record<string, string>;
    readonly optionalDependencies?: Record<string, string>;
  };
  const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];

  for (const dependencies of dependencyGroups) {
    const declaredVersion =
      dependencies?.["@rexeus/typeweaver"] ??
      dependencies?.["@rexeus/typeweaver-core"];

    if (!declaredVersion) {
      continue;
    }

    const normalizedVersion = tryNormalizeVersion(declaredVersion);

    if (normalizedVersion !== undefined) {
      return normalizedVersion;
    }
  }

  return undefined;
};

const tryNormalizeVersion = (version: string): string | undefined => {
  try {
    return normalizeVersion(version);
  } catch {
    return undefined;
  }
};

const getMigrationGuides = (version: string): readonly MigrationGuide[] => {
  const normalizedVersion = normalizeVersion(version);
  const versionParts = normalizedVersion.split(".");
  const major = Number(versionParts[0]);
  const minor = Number(versionParts[1]);

  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    throw new Error(
      `Unsupported version format '${version}'. Use a semver-like value such as 0.8.4.`
    );
  }

  if (major > 0 || minor >= 9) {
    return [];
  }

  if (minor === 8) {
    return [MIGRATION_GUIDE_08];
  }

  if (minor === 7) {
    return [MIGRATION_GUIDE_07, MIGRATION_GUIDE_08];
  }

  throw new Error(
    `No bundled migration guidance is available for ${version}. Use --from 0.7.x or --from 0.8.x for the supported upgrade paths.`
  );
};

const normalizeVersion = (version: string): string => {
  const match = version
    .trim()
    .match(
      /^(?:[~^]|>=|<=|>|<|=)?v?(\d+\.\d+(?:\.\d+)?)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u
    );
  const normalizedVersion = match?.[1];

  if (!normalizedVersion) {
    throw new Error(`Could not parse a Typeweaver version from '${version}'.`);
  }

  return normalizedVersion;
};
