import fs from "node:fs";
import path from "node:path";

export const findClosestNodeModules = (
  startDirectory: string
): string | undefined => {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    const candidatePath = path.join(currentDirectory, "node_modules");

    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
};

export const ensureSpecDependencyResolution = (
  specExecutionDir: string,
  inputFile: string
): boolean => {
  const targetNodeModulesPath = path.join(specExecutionDir, "node_modules");

  if (fs.existsSync(targetNodeModulesPath)) {
    return false;
  }

  const sourceNodeModulesPath = findClosestNodeModules(path.dirname(inputFile));

  if (!sourceNodeModulesPath) {
    return false;
  }

  fs.symlinkSync(
    sourceNodeModulesPath,
    targetNodeModulesPath,
    process.platform === "win32" ? "junction" : "dir"
  );

  return true;
};

export const createSpecDependencyResolutionBridge = (params: {
  readonly specExecutionDir: string;
  readonly inputFile: string;
}): (() => void) => {
  const wasCreated = ensureSpecDependencyResolution(
    params.specExecutionDir,
    params.inputFile
  );

  if (!wasCreated) {
    return () => {};
  }

  return () => {
    fs.rmSync(path.join(params.specExecutionDir, "node_modules"), {
      recursive: true,
      force: true,
    });
  };
};
