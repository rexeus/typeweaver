import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
import { buildPrecompiledLib } from "../../config/tsdown/buildPrecompiledLib.mjs";
import { createPackageBuildConfig } from "../../config/tsdown/createPackageBuildConfig.mjs";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  createPackageBuildConfig({
    packageDir,
    entry: ["src/index.ts"],
    libSourceDir: false,
    postBuildSteps: [
      () =>
        buildPrecompiledLib({
          packageDir,
          runtimeSourceDir: "src/lib",
          declarationSourceDir: "src/lib-declarations",
          outputDir: "dist/lib",
        }),
    ],
  })
);
