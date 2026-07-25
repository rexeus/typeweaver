import path from "node:path";
import { pathToFileURL } from "node:url";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Schema } from "effect";
import { ConfigModuleEvaluationError } from "../errors/ConfigModuleEvaluationError.js";
import { isStructuralConfigError } from "../errors/index.js";
import { InvalidConfigExportError } from "../errors/InvalidConfigExportError.js";
import { InvalidConfigValueError } from "../errors/InvalidConfigValueError.js";
import { UnsupportedConfigExtensionError } from "../errors/UnsupportedConfigExtensionError.js";
import { UnsupportedTypeScriptConfigError } from "../errors/UnsupportedTypeScriptConfigError.js";
import type { ConfigError } from "../errors/index.js";

const SUPPORTED_CONFIG_EXTENSIONS = [".js", ".mjs", ".cjs"] as const;
const SUPPORTED_CONFIG_EXTENSION_SET = new Set<string>(
  SUPPORTED_CONFIG_EXTENSIONS
);
const UNSUPPORTED_TYPESCRIPT_CONFIG_EXTENSIONS = new Set([
  ".ts",
  ".mts",
  ".cts",
]);

const PluginConfigSchema = Schema.mutable(
  Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })
);

const PluginTupleSchema = Schema.mutable(
  Schema.Tuple(Schema.NonEmptyString, PluginConfigSchema)
);

const PluginsSchema = Schema.mutable(
  Schema.Array(Schema.Union(Schema.NonEmptyString, PluginTupleSchema))
);

const TypeweaverConfigSchema = Schema.Struct({
  input: Schema.NonEmptyString,
  output: Schema.NonEmptyString,
  plugins: PluginsSchema,
  format: Schema.Boolean,
  clean: Schema.Boolean,
}).pipe(Schema.partialWith({ exact: true }), Schema.mutable);

/**
 * Resolve a possibly-relative config path against the current working
 * directory. Pure — does not touch the filesystem.
 */
export const getResolvedConfigPath = (
  configPath: string,
  currentWorkingDirectory: string = process.cwd()
): string =>
  path.isAbsolute(configPath)
    ? configPath
    : path.resolve(currentWorkingDirectory, configPath);

const assertSupportedConfigPathSync = (configPath: string): void => {
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

const loadConfigAsync = async (
  configPath: string
): Promise<Record<string, unknown>> => {
  assertSupportedConfigPathSync(configPath);

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

const isConfigObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNamespaceLikeConfigExport = (value: unknown): boolean => {
  if (!isConfigObject(value)) {
    return false;
  }
  return Object.hasOwn(value, "default") || Object.hasOwn(value, "config");
};

const decodeConfig = Effect.fn("typeweaver.ConfigLoader.decode")(
  (configPath: string, loadedConfig: Record<string, unknown>) =>
    Schema.decodeUnknown(TypeweaverConfigSchema, {
      errors: "all",
      onExcessProperty: "preserve",
    })(loadedConfig).pipe(
      Effect.mapError(
        cause => new InvalidConfigValueError({ configPath, cause })
      )
    )
);

/**
 * Loads a TypeWeaver config from a `.js`, `.mjs`, or `.cjs` module.
 *
 * `assertSupportedPath` rejects with the precise structural tagged error.
 * `load` wraps errors raised while evaluating the user's config module
 * (syntax errors, missing imports, custom throws) in
 * `ConfigModuleEvaluationError`, preserving the original failure on
 * `cause`. The failure channel is the closed `ConfigError` union, so every
 * variant is addressable via `Effect.catchTag`.
 */
export class ConfigLoader extends Effect.Service<ConfigLoader>()(
  "typeweaver/ConfigLoader",
  {
    succeed: {
      assertSupportedPath: (
        configPath: string
      ): Effect.Effect<void, ConfigError> =>
        Effect.try({
          try: () => assertSupportedConfigPathSync(configPath),
          catch: error => {
            if (isStructuralConfigError(error)) {
              return error;
            }
            throw error;
          },
        }),

      load: (
        configPath: string
      ): Effect.Effect<Partial<TypeweaverConfig>, ConfigError> =>
        Effect.tryPromise({
          try: () => loadConfigAsync(configPath),
          catch: error => {
            if (isStructuralConfigError(error)) {
              return error;
            }
            return new ConfigModuleEvaluationError({
              configPath,
              cause: error,
            });
          },
        }).pipe(
          Effect.flatMap(loadedConfig => decodeConfig(configPath, loadedConfig))
        ),
    },
    accessors: true,
  }
) {}
