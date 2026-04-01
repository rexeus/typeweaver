import path from "node:path";
import { pathToFileURL } from "node:url";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";

const SUPPORTED_CONFIG_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const UNSUPPORTED_TYPESCRIPT_CONFIG_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
]);

export const getResolvedConfigPath = (
  configPath: string,
  currentWorkingDirectory: string = process.cwd()
): string => {
  return path.isAbsolute(configPath)
    ? configPath
    : path.join(currentWorkingDirectory, configPath);
};

export const assertSupportedConfigPath = (configPath: string): void => {
  const extension = path.extname(configPath).toLowerCase();

  if (UNSUPPORTED_TYPESCRIPT_CONFIG_EXTENSIONS.has(extension)) {
    throw new Error(
      `TypeScript config files are no longer supported: '${configPath}'. Convert the config to .js, .mjs, or .cjs, or compile it before passing --config.`
    );
  }

  if (!SUPPORTED_CONFIG_EXTENSIONS.has(extension)) {
    throw new Error(
      `Unsupported config file extension for '${configPath}'. TypeWeaver only accepts .js, .mjs, or .cjs config files.`
    );
  }
};

export const loadConfig = async (
  configPath: string
): Promise<Partial<TypeweaverConfig>> => {
  assertSupportedConfigPath(configPath);

  const resolvedPath = path.resolve(configPath);
  const configUrl = pathToFileURL(resolvedPath).toString();
  const configModule = await import(configUrl);
  const loadedConfig = getConfigExport(configModule, configPath);

  if (!isConfigObject(loadedConfig)) {
    throw new Error(
      `Configuration file '${configPath}' must export a config object via 'export default' or 'export const config = ...'.`
    );
  }

  return loadedConfig;
};

const getConfigExport = (
  configModule: Record<string, unknown>,
  configPath: string
): unknown => {
  const hasDefaultExport = Object.hasOwn(configModule, "default");
  const hasNamedConfigExport = Object.hasOwn(configModule, "config");

  if (hasDefaultExport && hasNamedConfigExport) {
    throw new Error(
      `Configuration file '${configPath}' must choose a single export style: either 'export default' or 'export const config = ...', but not both.`
    );
  }

  if (hasDefaultExport) {
    if (isNamespaceLikeConfigExport(configModule.default)) {
      throw new Error(
        `Configuration file '${configPath}' default export must be the config object itself, not a module namespace-like wrapper. Export the config directly with 'export default { ... }' or use 'export const config = ...'.`
      );
    }

    return configModule.default;
  }

  if (hasNamedConfigExport) {
    return configModule.config;
  }

  throw new Error(
    `Configuration file '${configPath}' must export its config via 'export default' or 'export const config = ...'.`
  );
};

const isConfigObject = (value: unknown): value is Partial<TypeweaverConfig> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isNamespaceLikeConfigExport = (value: unknown): boolean => {
  if (!isConfigObject(value)) {
    return false;
  }

  return Object.hasOwn(value, "default") || Object.hasOwn(value, "config");
};
