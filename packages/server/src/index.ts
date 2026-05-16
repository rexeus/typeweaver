import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateRouters } from "./routerGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Typeweaver plugin that generates a lightweight, dependency-free server
 * with built-in routing and middleware support.
 *
 * Copies the runtime library files (`TypeweaverApp`, `TypeweaverRouter`,
 * `Router`, `Middleware`, etc.) and generates typed router classes for
 * each resource.
 */
export const serverPlugin: Plugin = definePluginWithLibCopy({
  name: "server",
  depends: ["types"],
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generateRouters],
});

export default serverPlugin;
