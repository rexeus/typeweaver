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
    external: ["oxfmt", "tsdown"],
    nodeProtocol: true,
    banner: "#!/usr/bin/env node",
    runSharedPostBuild: false,
  }),
  createPackageBuildConfig({
    packageDir,
    entry: ["src/index.ts", "src/cli.ts"],
    external: ["oxfmt", "tsdown"],
    nodeProtocol: true,
    libSourceDir: false,
    templateSourceDir: "src/generators/templates",
  }),
]);
