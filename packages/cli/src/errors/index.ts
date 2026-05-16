export { InvalidConfigExportError } from "./InvalidConfigExportError.js";
export type { InvalidConfigExportReason } from "./InvalidConfigExportError.js";
export { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";
export { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
export { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";

import type { InvalidConfigExportError } from "./InvalidConfigExportError.js";
import type { MissingGenerateOptionError } from "./MissingGenerateOptionError.js";
import type { UnsupportedConfigExtensionError } from "./UnsupportedConfigExtensionError.js";
import type { UnsupportedTypeScriptConfigError } from "./UnsupportedTypeScriptConfigError.js";

export type ConfigError =
  | InvalidConfigExportError
  | UnsupportedConfigExtensionError
  | UnsupportedTypeScriptConfigError;

export type GenerateOptionError = MissingGenerateOptionError;
