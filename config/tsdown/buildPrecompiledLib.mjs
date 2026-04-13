import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Emits precompiled runtime lib artifacts while keeping a TypeScript index
 * entrypoint for generated output projects.
 *
 * @param {{
 *   packageDir: string;
 *   runtimeSourceDir: string;
 *   declarationSourceDir?: string;
 *   outputDir: string;
 * }} options
 */
export function buildPrecompiledLib({
  packageDir,
  runtimeSourceDir,
  declarationSourceDir = undefined,
  outputDir,
}) {
  const absoluteRuntimeSourceDir = path.join(packageDir, runtimeSourceDir);
  const absoluteDeclarationSourceDir = declarationSourceDir
    ? path.join(packageDir, declarationSourceDir)
    : null;
  const absoluteOutputDir = path.join(packageDir, outputDir);

  fs.mkdirSync(absoluteOutputDir, { recursive: true });

  for (const relativeFilePath of getTypeScriptFiles(absoluteRuntimeSourceDir)) {
    if (relativeFilePath === "index.ts") {
      fs.cpSync(
        path.join(absoluteRuntimeSourceDir, relativeFilePath),
        path.join(absoluteOutputDir, relativeFilePath)
      );
      continue;
    }

    const sourceFilePath = path.join(
      absoluteRuntimeSourceDir,
      relativeFilePath
    );
    const outputFilePath = path.join(
      absoluteOutputDir,
      relativeFilePath.replace(/\.ts$/, ".js")
    );

    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, transpileTypeScriptFile(sourceFilePath));
  }

  if (
    absoluteDeclarationSourceDir &&
    fs.existsSync(absoluteDeclarationSourceDir)
  ) {
    fs.cpSync(absoluteDeclarationSourceDir, absoluteOutputDir, {
      recursive: true,
    });
  }
}

/** @param {string} sourceDir */
export function getTypeScriptFiles(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  return collectTypeScriptFiles(sourceDir).sort();
}

function collectTypeScriptFiles(sourceDir, currentDir = sourceDir) {
  const relativeFilePaths = [];

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      relativeFilePaths.push(...collectTypeScriptFiles(sourceDir, entryPath));
      continue;
    }

    if (
      !entry.isFile() ||
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".d.ts")
    ) {
      continue;
    }

    relativeFilePaths.push(path.relative(sourceDir, entryPath));
  }

  return relativeFilePaths;
}

function transpileTypeScriptFile(sourceFilePath) {
  const source = fs.readFileSync(sourceFilePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      verbatimModuleSyntax: true,
    },
    fileName: path.basename(sourceFilePath),
  });

  return outputText;
}
