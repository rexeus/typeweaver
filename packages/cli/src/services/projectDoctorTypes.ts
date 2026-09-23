import type {
  PluginRegistryShape,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import type { DoctorCheck } from "../reports/DoctorReport.js";
import type { ConfigLoaderShape } from "./ConfigLoader.js";
import type { PluginLoaderShape } from "./PluginLoaderService.js";
import type { ProjectValidatorShape } from "./ProjectValidator.js";

export type DiagnoseProjectParams = {
  readonly currentWorkingDirectory: string;
  readonly input?: string | undefined;
  readonly output?: string | undefined;
  readonly configPath?: string | undefined;
  readonly plugins?: string | undefined;
  readonly deep: boolean;
};

export type DoctorInputs = {
  readonly config: Partial<TypeweaverConfig>;
  readonly configHealthy: boolean;
  readonly inputFile?: string;
  readonly outputDir?: string;
};

export type ResolvedDoctorInputs = {
  readonly inputs: DoctorInputs;
  readonly configCheck: DoctorCheck;
};

export type DeepValidationParams = {
  readonly inputs: DoctorInputs;
  readonly prerequisiteChecks: readonly DoctorCheck[];
  readonly deep: boolean;
  readonly currentWorkingDirectory: string;
};

export type ProjectDoctorServices = {
  readonly configLoader: ConfigLoaderShape;
  readonly pluginLoader: PluginLoaderShape;
  readonly pluginRegistry: PluginRegistryShape;
  readonly projectValidator: ProjectValidatorShape;
};
