import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

// Create alias map for Node.js builtins to use node: prefix
const nodeBuiltinAlias = Object.fromEntries(
  builtinModules
    .filter(mod => !mod.startsWith("_"))
    .map(mod => [mod, `node:${mod}`])
);

export default defineConfig([
  // Entry point with shebang for bin execution
  {
    entry: ["src/entry.ts"],
    format: ["esm"],
    target: "esnext",
    platform: "node",
    shims: true,
    removeNodeProtocol: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    esbuildOptions(options) {
      options.alias = {
        ...options.alias,
        ...nodeBuiltinAlias,
      };
    },
  },
  // Other entry points without shebang
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    shims: true,
    target: "esnext",
    platform: "node",
    removeNodeProtocol: false,
    esbuildOptions(options) {
      options.alias = {
        ...options.alias,
        ...nodeBuiltinAlias,
      };
    },
  },
]);
