import { Effect } from "effect";
import { PluginScaffolder } from "./services/PluginScaffolder.js";

export type AddPluginHandlerInput = {
  readonly name: string;
  readonly target: string;
};

export type AddPluginHandlerConfig = {
  readonly currentWorkingDirectory: string;
  readonly templateDir: string;
  readonly typeweaverVersion: string;
};

export const runAddPlugin = (
  args: AddPluginHandlerInput,
  config: AddPluginHandlerConfig
) =>
  Effect.gen(function* () {
    const result = yield* PluginScaffolder.scaffold({
      pluginName: args.name,
      targetDir: args.target,
      currentWorkingDirectory: config.currentWorkingDirectory,
      templateDir: config.templateDir,
      typeweaverVersion: config.typeweaverVersion,
    });

    yield* Effect.logInfo(
      `Created TypeWeaver plugin '${args.name}' at ${result.targetDir}`
    );
    yield* Effect.logInfo(
      `Next: cd ${result.targetDir} && pnpm install && pnpm check`
    );
  });
