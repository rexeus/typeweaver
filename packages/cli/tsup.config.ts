import { builtinModules } from "node:module";
import { defineConfig } from "tsup";

// Create alias map for Node.js builtins to use node: prefix
const nodeBuiltinAlias = Object.fromEntries(
  builtinModules
    .filter(mod => !mod.startsWith("_"))
    .map(mod => [mod, `node:${mod}`])
);

export default defineConfig({
  entry: ["src/index.ts", "src/entry.ts", "src/cli.ts"],
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
});
