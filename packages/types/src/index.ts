import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyPluginLibFiles,
  definePlugin,
  PluginExecutionError,
} from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generate as generateRequests } from "./requestGenerator.js";
import { generate as generateRequestValidators } from "./requestValidationGenerator.js";
import { generate as generateResponses } from "./responseGenerator.js";
import { generate as generateResponseValidators } from "./responseValidationGenerator.js";

const PLUGIN_NAME = "types";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const libSourceDir = path.join(moduleDir, "lib");

export const typesPlugin: Plugin = definePlugin({
  name: PLUGIN_NAME,
  generate: context =>
    Effect.try({
      try: () => {
        copyPluginLibFiles({
          context,
          libSourceDir,
          libNamespace: PLUGIN_NAME,
        });
        generateRequests(context);
        generateRequestValidators(context);
        generateResponses(context);
        generateResponseValidators(context);
      },
      catch: cause =>
        new PluginExecutionError({
          pluginName: PLUGIN_NAME,
          phase: "generate",
          cause,
        }),
    }),
});

export default typesPlugin;
