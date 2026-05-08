import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const REPOSITORY_ARTIFACTS = ["LICENSE", "NOTICE"];
const execAsync = promisify(exec);

function createDefaultBuildOptions() {
  return {
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "esnext",
    platform: "node",
    treeshake: true,
  };
}

export function createPackageBuildConfig(options) {
  const {
    packageDir,
    libSourceDir = "src/lib",
    templateSourceDir = "src/templates",
    includeLicenseArtifacts = true,
    postBuildSteps = [],
    runSharedPostBuild = true,
    ...config
  } = options;
  const callerOnSuccess = config.onSuccess;

  if (!runSharedPostBuild) {
    return {
      ...createDefaultBuildOptions(),
      ...config,
    };
  }

  return {
    ...createDefaultBuildOptions(),
    ...config,
    onSuccess: async (resolvedConfig, signal) => {
      const distDir = path.join(packageDir, "dist");
      fs.mkdirSync(distDir, { recursive: true });

      copyDirectoryIfPresent({
        packageDir,
        sourceDir: libSourceDir,
        destinationDir: "dist/lib",
      });
      copyDirectoryIfPresent({
        packageDir,
        sourceDir: templateSourceDir,
        destinationDir: "dist/templates",
      });

      if (includeLicenseArtifacts) {
        copyRepositoryArtifacts(packageDir, distDir);
      }

      for (const postBuildStep of postBuildSteps) {
        await postBuildStep({ packageDir, distDir });
      }

      await runCallerOnSuccess(callerOnSuccess, resolvedConfig, signal);
    },
  };
}

async function runCallerOnSuccess(callerOnSuccess, resolvedConfig, signal) {
  if (typeof callerOnSuccess === "function") {
    await callerOnSuccess(resolvedConfig, signal);
    return;
  }

  if (typeof callerOnSuccess === "string") {
    await execAsync(callerOnSuccess, {
      cwd: resolvedConfig?.cwd,
      signal,
    });
  }
}

function copyDirectoryIfPresent({ packageDir, sourceDir, destinationDir }) {
  if (sourceDir === false) {
    return;
  }

  const absoluteSourceDir = path.join(packageDir, sourceDir);
  if (!fs.existsSync(absoluteSourceDir)) {
    return;
  }

  const absoluteDestinationDir = path.join(packageDir, destinationDir);
  fs.cpSync(absoluteSourceDir, absoluteDestinationDir, { recursive: true });
}

function copyRepositoryArtifacts(packageDir, distDir) {
  // Shared build configs are only used by packages at <repoRoot>/packages/<name>.
  const repositoryRoot = path.resolve(packageDir, "../..");

  for (const artifactName of REPOSITORY_ARTIFACTS) {
    fs.cpSync(
      path.join(repositoryRoot, artifactName),
      path.join(distDir, artifactName)
    );
  }
}
