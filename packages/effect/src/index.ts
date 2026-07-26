import { definePlugin, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type { Plugin } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { generateEffectHandlers } from "./effectHandlerGenerator.js";

export {
  createEffectHandlerRuntime,
  EffectHandlerDefectError,
  EffectHandlerInterruptedError,
} from "./runtime.js";
export type {
  EffectHandlerContext,
  EffectHandlerErrorMapper,
  EffectHandlerRoute,
  EffectHandlerRuntime,
  EffectRequestHandler,
} from "./runtime.js";

export const effectPlugin: Plugin = definePlugin({
  name: "effect",
  depends: ["server"],
  generate: context =>
    Effect.try({
      try: () => generateEffectHandlers(context),
      catch: cause =>
        new PluginExecutionError({
          pluginName: "effect",
          phase: "generate",
          cause,
        }),
    }),
});

export default effectPlugin;
