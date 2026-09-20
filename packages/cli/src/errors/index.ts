export { CleanTargetInspectionError } from "./CleanTargetInspectionError.js";
export { ConcurrentGenerationError } from "./ConcurrentGenerationError.js";
export { ConfigModuleEvaluationError } from "./ConfigModuleEvaluationError.js";
export { GeneratedOutputDriftError } from "./GeneratedOutputDriftError.js";
export { InvalidConfigExportError } from "./InvalidConfigExportError.js";
export type { InvalidConfigExportReason } from "./InvalidConfigExportError.js";
export { InvalidConfigValueError } from "./InvalidConfigValueError.js";
export { LegacyOutputLockError } from "./LegacyOutputLockError.js";
export type { LegacyOutputLockReason } from "./LegacyOutputLockError.js";
export { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";
export { OutputCleanError } from "./OutputCleanError.js";
export {
  OutputComparisonReadError,
  OutputSnapshotError,
  UnsupportedOutputEntryError,
} from "./OutputComparisonError.js";
export type { UnsupportedOutputEntryType } from "./OutputComparisonError.js";
export { OutputLockError } from "./OutputLockError.js";
export type { OutputLockOperation } from "./OutputLockError.js";
export { ReservedCoordinationPathError } from "./ReservedCoordinationPathError.js";
export type { ReservedCoordinationPathReason } from "./ReservedCoordinationPathError.js";
export { PluginLoadError } from "./PluginLoadError.js";
export {
  InvalidPluginScaffoldNameError,
  PluginScaffoldFileSystemError,
  PluginScaffoldTargetExistsError,
} from "./PluginScaffoldError.js";
export type { PluginScaffoldFileSystemOperation } from "./PluginScaffoldError.js";
export type { PluginLoadAttempt } from "./PluginLoadError.js";
export { UnsafeCleanTargetError } from "./UnsafeCleanTargetError.js";
export type {
  UnsafeCleanTargetDetails,
  UnsafeCleanTargetReason,
} from "./UnsafeCleanTargetError.js";
export { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
export { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";
export { UnsafeSharedTempDirectoryError } from "./UnsafeSharedTempDirectoryError.js";
export type { UnsafeSharedTempDirectoryReason } from "./UnsafeSharedTempDirectoryError.js";
export { UnsafeStagingRootError } from "./UnsafeStagingRootError.js";
export type { UnsafeStagingRootReason } from "./UnsafeStagingRootError.js";

import type { ConfigModuleEvaluationError } from "./ConfigModuleEvaluationError.js";
import type { InvalidConfigExportError } from "./InvalidConfigExportError.js";
import type { InvalidConfigValueError } from "./InvalidConfigValueError.js";
import type { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";
import type { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
import type { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";

export { isStructuralConfigError } from "./isStructuralConfigError.js";

export type ConfigError =
  | ConfigModuleEvaluationError
  | InvalidConfigExportError
  | InvalidConfigValueError
  | UnsupportedConfigExtensionError
  | UnsupportedTypeScriptConfigError;

export type GenerateOptionError = MissingGenerateOptionError;
