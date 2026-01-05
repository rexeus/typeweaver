import { builtinModules } from "node:module";
import { defineConfig } from "tsup";
import type { Options } from "tsup";

// Create alias map for Node.js builtins to use node: prefix
const nodeBuiltinAlias = Object.fromEntries(
  builtinModules
    .filter(mod => !mod.startsWith("_"))
    .map(mod => [mod, `node:${mod}`])
);

// Shared esbuild options for Node.js builtin aliasing
const sharedEsbuildOptions: Options["esbuildOptions"] = options => {
  options.alias = {
    ...options.alias,
    ...nodeBuiltinAlias,
  };
};

export default defineConfig([
  // Entry point with shebang for bin execution
  {
    entry: ["src/entry.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    target: "esnext",
    platform: "node",
    shims: true,
    removeNodeProtocol: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    esbuildOptions: sharedEsbuildOptions,
  },
  // Library entry points without shebang
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "esnext",
    platform: "node",
    shims: true,
    removeNodeProtocol: false,
    esbuildOptions: sharedEsbuildOptions,
  },
]);
