export { MissingCanonicalResponseError } from "./MissingCanonicalResponseError.js";
export { PluginDependencyError } from "./PluginDependencyError.js";
export { PluginExecutionError } from "./PluginExecutionError.js";
export type { PluginExecutionPhase } from "./PluginExecutionError.js";

import type { MissingCanonicalResponseError } from "./MissingCanonicalResponseError.js";
import type { PluginDependencyError } from "./PluginDependencyError.js";
import type { PluginExecutionError } from "./PluginExecutionError.js";

/**
 * Tagged union of every error the plugin subsystem may raise.
 */
export type PluginError =
  | MissingCanonicalResponseError
  | PluginDependencyError
  | PluginExecutionError;
