import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type PackageFixtureOptions = {
  readonly createRepositoryArtifacts?: boolean;
  readonly registerTempDirectory?: (directory: string) => void;
};
export type PackageFixture = {
  readonly packageDir: string;
  readonly repositoryRoot: string;
};
export type PostBuildContext = {
  readonly distDir: string;
  readonly packageDir: string;
};

export class TestBuildConfigError extends Error {
  public override readonly name = "TestBuildConfigError";
}

export function cleanupTempDirectories(tempDirectories: string[]): void {
  while (tempDirectories.length > 0) {
    const tempDirectory = tempDirectories.pop();
    if (tempDirectory !== undefined) {
      fs.rmSync(tempDirectory, { force: true, recursive: true });
    }
  }
}

export function createPackageFixture(
  packageName: string,
  options: PackageFixtureOptions = {}
): PackageFixture {
  const { createRepositoryArtifacts = true } = options;
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-build-config-")
  );
  const packageDir = path.join(repositoryRoot, "packages", packageName);
  fs.mkdirSync(packageDir, { recursive: true });
  if (createRepositoryArtifacts) {
    fs.writeFileSync(path.join(repositoryRoot, "LICENSE"), "license");
    fs.writeFileSync(path.join(repositoryRoot, "NOTICE"), "notice");
  }
  options.registerTempDirectory?.(repositoryRoot);
  return { packageDir, repositoryRoot };
}

export function writePackageFile(
  packageDir: string,
  relativePath: string,
  content: string
): void {
  const filePath = path.join(packageDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export function readPackageFile(
  packageDir: string,
  relativePath: string
): string {
  return fs.readFileSync(path.join(packageDir, relativePath), "utf8");
}

export function packageFileExists(
  packageDir: string,
  relativePath: string
): boolean {
  return fs.existsSync(path.join(packageDir, relativePath));
}

export function createNodeOnSuccessCommand(
  packageDir: string,
  scriptName: string,
  scriptContent: string
): string {
  writePackageFile(packageDir, path.join("scripts", scriptName), scriptContent);
  return [process.execPath, `./scripts/${scriptName}`]
    .map(commandPart => JSON.stringify(commandPart))
    .join(" ");
}
