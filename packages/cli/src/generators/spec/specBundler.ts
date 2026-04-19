import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "rolldown";

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

export type SpecBundlerConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export function createWrapperImportSpecifier(
  wrapperFile: string,
  inputFile: string
): string {
  const absoluteInputFile = resolveBundledInputFile(inputFile);
  const useWindowsPathSemantics = usesWindowsPathSemantics(
    wrapperFile,
    absoluteInputFile
  );
  const pathModule = useWindowsPathSemantics ? path.win32 : path.posix;
  const wrapperDir = useWindowsPathSemantics
    ? pathModule.dirname(wrapperFile)
    : resolveRealFilePath(pathModule.dirname(wrapperFile));
  const resolvedInputFile = useWindowsPathSemantics
    ? absoluteInputFile
    : resolveRealFilePath(absoluteInputFile);
  const relativeInputFile = pathModule
    .relative(wrapperDir, resolvedInputFile)
    .replaceAll(pathModule.sep, "/");

  if (relativeInputFile.startsWith(".") || relativeInputFile.startsWith("..")) {
    return relativeInputFile;
  }

  return `./${relativeInputFile}`;
}

export async function bundle(config: SpecBundlerConfig): Promise<string> {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-spec-loader-")
  );
  const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
  const bundledSpecFile = path.join(config.specOutputDir, "spec.js");
  const wrapperImportSpecifier = createWrapperImportSpecifier(
    wrapperFile,
    config.inputFile
  );

  fs.writeFileSync(
    wrapperFile,
    [
      `import * as specModule from ${JSON.stringify(wrapperImportSpecifier)};`,
      "const resolvedSpec =",
      '  Reflect.get(specModule, "spec") ??',
      '  Reflect.get(specModule, "default") ??',
      "  specModule;",
      "",
      "export const spec = resolvedSpec;",
      "",
    ].join("\n")
  );

  try {
    await build({
      cwd: tempDir,
      input: wrapperFile,
      treeshake: true,
      experimental: {
        attachDebugInfo: "none",
      },
      external: isExternalSpecImport,
      output: {
        file: bundledSpecFile,
        format: "esm",
      },
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(bundledSpecFile)) {
    throw new Error(
      `Failed to bundle spec entrypoint '${config.inputFile}' to '${bundledSpecFile}'.`
    );
  }

  return bundledSpecFile;
}

export function isExternalSpecImport(source: string): boolean {
  return !isBundledSpecImport(source);
}

function isBundledSpecImport(source: string): boolean {
  return (
    source.startsWith(".") ||
    source.startsWith("/") ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(source) ||
    WINDOWS_UNC_PATH_PATTERN.test(source)
  );
}

function resolveBundledInputFile(inputFile: string): string {
  if (path.isAbsolute(inputFile)) {
    return inputFile;
  }

  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(inputFile)) {
    return path.win32.normalize(inputFile);
  }

  if (WINDOWS_UNC_PATH_PATTERN.test(inputFile)) {
    return path.win32.normalize(inputFile);
  }

  return path.resolve(inputFile);
}

function usesWindowsPathSemantics(...filePaths: string[]): boolean {
  return filePaths.some(filePath => {
    return (
      WINDOWS_ABSOLUTE_PATH_PATTERN.test(filePath) ||
      WINDOWS_UNC_PATH_PATTERN.test(filePath)
    );
  });
}

function resolveRealFilePath(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return filePath;
  }

  return fs.realpathSync.native(filePath);
}
