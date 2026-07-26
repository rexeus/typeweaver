import path from "node:path";
import { fileURLToPath } from "node:url";
import { definePluginWithLibCopy } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { generate as generateRequests } from "./requestGenerator.js";
import { generate as generateRequestValidators } from "./requestValidationGenerator.js";
import { generate as generateResponses } from "./responseGenerator.js";
import { generate as generateResponseValidators } from "./responseValidationGenerator.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const typesPlugin: Plugin = definePluginWithLibCopy({
  name: "types",
  libSourceDir: path.join(moduleDir, "lib"),
  generators: [
    generateRequests,
    generateRequestValidators,
    generateResponses,
    generateResponseValidators,
  ],
});

export default typesPlugin;
