export { MissingCanonicalResponseError } from "./MissingCanonicalResponseError.js";
export { PluginConfigError } from "./PluginConfigError.js";
export { PluginDependencyError } from "./PluginDependencyError.js";
export type { PluginDependencyIssue } from "./PluginDependencyError.js";
export { PluginExecutionError } from "./PluginExecutionError.js";
export type { PluginExecutionPhase } from "./PluginExecutionError.js";

import type { MissingCanonicalResponseError } from "./MissingCanonicalResponseError.js";
import type { PluginConfigError } from "./PluginConfigError.js";
import type { PluginDependencyError } from "./PluginDependencyError.js";
import type { PluginExecutionError } from "./PluginExecutionError.js";

/**
 * Tagged union of every error the plugin subsystem may raise.
 */
export type PluginError =
  | MissingCanonicalResponseError
  | PluginConfigError
  | PluginDependencyError
  | PluginExecutionError;
