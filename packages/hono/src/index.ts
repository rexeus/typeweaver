import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateHonoRouters } from "./honoRouterGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const honoPlugin: Plugin = definePluginWithLibCopy({
  name: "hono",
  depends: ["types"],
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generateHonoRouters],
});

export default honoPlugin;
