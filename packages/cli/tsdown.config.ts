import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/entry.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    target: "esnext",
    platform: "node",
    treeshake: true,
    external: ["oxfmt"],
    nodeProtocol: true,
    banner: "#!/usr/bin/env node",
  },
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "esnext",
    platform: "node",
    treeshake: true,
    external: ["oxfmt"],
    nodeProtocol: true,
  },
]);
