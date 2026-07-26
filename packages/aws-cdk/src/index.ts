import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateHttpApiRoutes } from "./httpApiRouterGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const awsCdkPlugin: Plugin = definePluginWithLibCopy({
  name: "aws-cdk",
  depends: ["types"],
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [generateHttpApiRoutes],
});

export default awsCdkPlugin;
