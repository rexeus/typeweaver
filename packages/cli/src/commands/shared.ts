import path from "node:path";
import type { CommandOptions as CommanderOptions } from "commander";
import { createLogger, type Logger } from "../logger.js";

export type SharedCommandOptions = CommanderOptions & {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly noColor?: boolean;
};

export const createCommandLogger = (options: SharedCommandOptions): Logger => {
  return createLogger({
    verbose: options.verbose,
    quiet: options.quiet,
    color: options.noColor ? false : undefined,
  });
};

export const resolveCommandPath = (execDir: string, filePath: string): string => {
  return path.isAbsolute(filePath) ? filePath : path.join(execDir, filePath);
};

export const resolvePluginList = (plugins: string | undefined): string[] | undefined => {
  if (!plugins) {
    return undefined;
  }

  const resolvedPlugins = plugins
    .split(",")
    .map(plugin => plugin.trim())
    .filter(plugin => plugin.length > 0);

  return resolvedPlugins.length > 0 ? resolvedPlugins : undefined;
};
