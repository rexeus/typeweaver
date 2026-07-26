export { CleanTargetInspectionError } from "./CleanTargetInspectionError.js";
export { ConcurrentGenerationError } from "./ConcurrentGenerationError.js";
export { ConfigModuleEvaluationError } from "./ConfigModuleEvaluationError.js";
export { InvalidConfigExportError } from "./InvalidConfigExportError.js";
export type { InvalidConfigExportReason } from "./InvalidConfigExportError.js";
export { InvalidConfigValueError } from "./InvalidConfigValueError.js";
export { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";
export { OutputCleanError } from "./OutputCleanError.js";
export { OutputLockError } from "./OutputLockError.js";
export type { OutputLockOperation } from "./OutputLockError.js";
export { PluginLoadError } from "./PluginLoadError.js";
export type { PluginLoadAttempt } from "./PluginLoadError.js";
export { UnsafeCleanTargetError } from "./UnsafeCleanTargetError.js";
export type {
  UnsafeCleanTargetDetails,
  UnsafeCleanTargetReason,
} from "./UnsafeCleanTargetError.js";
export { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
export { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";

import { InvalidConfigExportError } from "./InvalidConfigExportError.js";
import { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
import { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";
import type { ConfigModuleEvaluationError } from "./ConfigModuleEvaluationError.js";
import type { InvalidConfigValueError } from "./InvalidConfigValueError.js";
import type { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";

export type ConfigError =
  | ConfigModuleEvaluationError
  | InvalidConfigExportError
  | InvalidConfigValueError
  | UnsupportedConfigExtensionError
  | UnsupportedTypeScriptConfigError;

export type GenerateOptionError = MissingGenerateOptionError;

/**
 * Predicate that recognises the structural tagged errors the config loader
 * raises itself while resolving and validating the config module. It
 * deliberately excludes `ConfigModuleEvaluationError`: the loader uses this
 * guard to decide whether a thrown value is already one of its own tagged
 * errors or an arbitrary evaluation failure that still needs wrapping.
 */
export const isStructuralConfigError = (
  error: unknown
): error is
  | InvalidConfigExportError
  | UnsupportedConfigExtensionError
  | UnsupportedTypeScriptConfigError =>
  error instanceof InvalidConfigExportError ||
  error instanceof UnsupportedConfigExtensionError ||
  error instanceof UnsupportedTypeScriptConfigError;
