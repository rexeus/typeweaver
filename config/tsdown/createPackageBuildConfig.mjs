import fs from "node:fs";
import path from "node:path";

const REPOSITORY_ARTIFACTS = ["LICENSE", "NOTICE"];

const DEFAULT_BUILD_OPTIONS = {
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "esnext",
  platform: "node",
  treeshake: true,
};

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

  if (!runSharedPostBuild) {
    return {
      ...DEFAULT_BUILD_OPTIONS,
      ...config,
    };
  }

  return {
    ...DEFAULT_BUILD_OPTIONS,
    ...config,
    onSuccess: async () => {
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
    },
  };
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
