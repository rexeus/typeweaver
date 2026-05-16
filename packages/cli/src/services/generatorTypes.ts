import type {
  NormalizationError,
  PluginDependencyError,
  PluginExecutionError,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import type { PluginLoadError } from "../generators/errors/PluginLoadError.js";
import type { UnsafeCleanTargetError } from "../generators/errors/UnsafeCleanTargetError.js";
import type {
  InvalidSpecEntrypointError,
  SpecBundleError,
  SpecBundleOutputMissingError,
  SpecOutputWriteError,
} from "../generators/spec/errors/index.js";

export type GenerateParams = {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory?: string;
};

export type GenerateFailure =
  | UnsafeCleanTargetError
  | PluginLoadError
  | PluginDependencyError
  | PluginExecutionError
  | InvalidSpecEntrypointError
  | NormalizationError
  | SpecBundleError
  | SpecBundleOutputMissingError
  | SpecOutputWriteError;
