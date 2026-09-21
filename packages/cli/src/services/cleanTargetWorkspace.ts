import path from "node:path";
import type { CleanTargetFs } from "./cleanTargetTypes.js";

const fileOnlyWorkspaceMarkers = [
  ".git",
  "pnpm-workspace.yaml",
  "lerna.json",
  "nx.json",
  "turbo.json",
  "rush.json",
] as const;

const hasWorkspacesField = (
  packageJsonPath: string,
  fileSystem: CleanTargetFs
): boolean => {
  try {
    const parsed: unknown = JSON.parse(
      fileSystem.readFileString(packageJsonPath)
    );
    if (typeof parsed !== "object" || parsed === null) return false;
    return Boolean(Reflect.get(parsed, "workspaces"));
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};

export const hasWorkspaceMarker = (
  directory: string,
  fileSystem: CleanTargetFs
): boolean => {
  if (
    fileOnlyWorkspaceMarkers.some(marker =>
      fileSystem.exists(path.join(directory, marker))
    )
  ) {
    return true;
  }
  const packageJsonPath = path.join(directory, "package.json");
  return (
    fileSystem.exists(packageJsonPath) &&
    hasWorkspacesField(packageJsonPath, fileSystem)
  );
};

export const findProtectedWorkspaceRoot = (
  startDirectory: string,
  fileSystem: CleanTargetFs
): string | undefined => {
  let currentDirectory = startDirectory;
  while (true) {
    if (hasWorkspaceMarker(currentDirectory, fileSystem))
      return currentDirectory;
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) return undefined;
    currentDirectory = parentDirectory;
  }
};
