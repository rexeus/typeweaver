export { InvalidConfigExportError } from "./InvalidConfigExportError.js";
export type { InvalidConfigExportReason } from "./InvalidConfigExportError.js";
export { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";
export { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
export { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";

import { InvalidConfigExportError } from "./InvalidConfigExportError.js";
import { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
import { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";
import type { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";

export type ConfigError =
  | InvalidConfigExportError
  | UnsupportedConfigExtensionError
  | UnsupportedTypeScriptConfigError;

export type GenerateOptionError = MissingGenerateOptionError;

/**
 * Predicate that recognises every tagged error the config loader surfaces.
 * Caller code that needs to distinguish typed config failures from
 * arbitrary user-thrown errors (e.g. a config module that throws on
 * evaluation) can branch on this guard.
 */
export const isConfigError = (error: unknown): error is ConfigError =>
  error instanceof InvalidConfigExportError ||
  error instanceof UnsupportedConfigExtensionError ||
  error instanceof UnsupportedTypeScriptConfigError;
