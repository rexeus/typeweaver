import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";
import { createPackageBuildConfig } from "../../config/tsdown/createPackageBuildConfig.mjs";

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  createPackageBuildConfig({
    packageDir,
    entry: ["src/entry.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    // `entry.ts` intentionally starts the CLI through a dynamic import after
    // reporting the detected runtime. The imported module's execution is the
    // observable side effect, so this entry build must preserve it even though
    // the package declares `sideEffects: false`.
    treeshake: false,
    deps: {
      neverBundle: ["oxfmt", "rolldown"],
    },
    nodeProtocol: true,
    banner: "#!/usr/bin/env node",
    runSharedPostBuild: false,
  }),
  createPackageBuildConfig({
    packageDir,
    entry: ["src/index.ts", "src/cli.ts"],
    deps: {
      neverBundle: ["oxfmt", "rolldown"],
    },
    nodeProtocol: true,
    libSourceDir: false,
    templateSourceDir: "src/templates",
  }),
]);
