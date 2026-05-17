import type {
  NormalizationError,
  PluginDependencyError,
  PluginExecutionError,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import type { ConcurrentGenerationError } from "../errors/ConcurrentGenerationError.js";
import type { PluginLoadError } from "../errors/PluginLoadError.js";
import type { UnsafeCleanTargetError } from "../errors/UnsafeCleanTargetError.js";
import type { IndexFileGenerationError } from "./errors/IndexFileGenerationError.js";
import type {
  InvalidSpecEntrypointError,
  SpecBundleError,
  SpecBundleOutputMissingError,
  SpecOutputWriteError,
} from "./errors/specErrors.js";
import type { PlatformError } from "@effect/platform/Error";

export type GenerateParams = {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory?: string;
};

export type GenerateFailure =
  | ConcurrentGenerationError
  | UnsafeCleanTargetError
  | PluginLoadError
  | PluginDependencyError
  | PluginExecutionError
  | InvalidSpecEntrypointError
  | NormalizationError
  | SpecBundleError
  | SpecBundleOutputMissingError
  | SpecOutputWriteError
  | IndexFileGenerationError
  | PlatformError;
