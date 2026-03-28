import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Rolldown } from "tsdown";

export type SpecBundlerConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export async function bundle(config: SpecBundlerConfig): Promise<string> {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-spec-loader-")
  );
  const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
  const bundledSpecFile = path.join(config.specOutputDir, "spec.js");
  const normalizedInputFile = config.inputFile.replaceAll(path.sep, "/");

  fs.writeFileSync(
    wrapperFile,
    [
      `import * as specModule from ${JSON.stringify(normalizedInputFile)};`,
      "const resolvedSpec =",
      '  Reflect.get(specModule, "default") ??',
      '  Reflect.get(specModule, "spec") ??',
      "  specModule;",
      "",
      "export default resolvedSpec;",
      "export const spec = resolvedSpec;",
      "",
    ].join("\n")
  );

  try {
    await Rolldown.build({
      cwd: tempDir,
      input: wrapperFile,
      treeshake: true,
      external: (source: string) => {
        if (source.startsWith("node:")) {
          return true;
        }

        return !source.startsWith(".") && !path.isAbsolute(source);
      },
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
