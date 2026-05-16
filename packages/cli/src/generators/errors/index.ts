export { PluginLoadError } from "./PluginLoadError.js";
export type { PluginLoadAttempt } from "./PluginLoadError.js";
export { UnsafeCleanTargetError } from "./UnsafeCleanTargetError.js";
export type { UnsafeCleanTargetReason } from "./UnsafeCleanTargetError.js";

import type { PluginLoadError } from "./PluginLoadError.js";
import type { UnsafeCleanTargetError } from "./UnsafeCleanTargetError.js";

export type GenerationError = PluginLoadError | UnsafeCleanTargetError;
