import path from "node:path";
import { pathToFileURL } from "node:url";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { InvalidConfigExportError } from "./errors/InvalidConfigExportError.js";
import { UnsupportedConfigExtensionError } from "./errors/UnsupportedConfigExtensionError.js";
import { UnsupportedTypeScriptConfigError } from "./errors/UnsupportedTypeScriptConfigError.js";

const SUPPORTED_CONFIG_EXTENSIONS = [".js", ".mjs", ".cjs"] as const;
const SUPPORTED_CONFIG_EXTENSION_SET = new Set<string>(
  SUPPORTED_CONFIG_EXTENSIONS
);
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
    : path.resolve(currentWorkingDirectory, configPath);
};

export const assertSupportedConfigPath = (configPath: string): void => {
  const extension = path.extname(configPath).toLowerCase();

  if (UNSUPPORTED_TYPESCRIPT_CONFIG_EXTENSIONS.has(extension)) {
    throw new UnsupportedTypeScriptConfigError({ configPath, extension });
  }

  if (!SUPPORTED_CONFIG_EXTENSION_SET.has(extension)) {
    throw new UnsupportedConfigExtensionError({
      configPath,
      extension,
      supportedExtensions: SUPPORTED_CONFIG_EXTENSIONS,
    });
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
    throw new InvalidConfigExportError({
      configPath,
      reason: "non-object-config",
    });
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
    throw new InvalidConfigExportError({
      configPath,
      reason: "both-default-and-named-config",
    });
  }

  if (hasDefaultExport) {
    if (isNamespaceLikeConfigExport(configModule.default)) {
      throw new InvalidConfigExportError({
        configPath,
        reason: "default-namespace-wrapper",
      });
    }

    return configModule.default;
  }

  if (hasNamedConfigExport) {
    return configModule.config;
  }

  throw new InvalidConfigExportError({
    configPath,
    reason: "missing-config-export",
  });
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
