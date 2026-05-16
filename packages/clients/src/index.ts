import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateClients } from "./clientGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const clientsPlugin: Plugin = definePluginWithLibCopy({
  name: "clients",
  depends: ["types"],
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generateClients],
});

export default clientsPlugin;
