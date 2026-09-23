import { Effect } from "effect";
import { checkEffectReference, checkFormatter } from "./doctorEnvironment.js";
import {
  checkInput,
  checkNodeVersion,
  checkOutput,
  checkPackageManager,
  checkRuntime,
} from "./doctorEnvironmentRuntime.js";
import { checkWorkspaceEffectCompatibility } from "./effectCompatibility.js";
import { checkDeepValidation, checkPlugins } from "./projectDoctorChecks.js";
import { loadInputs } from "./projectDoctorInputs.js";
import type { DoctorCheck } from "../reports/DoctorReport.js";
import type {
  DiagnoseProjectParams,
  ProjectDoctorServices,
} from "./projectDoctorTypes.js";

/**
 * Runs every doctor check against the resolved project inputs and returns
 * them in report order.
 */
export const diagnoseProject = (
  services: ProjectDoctorServices,
  params: DiagnoseProjectParams
): Effect.Effect<readonly DoctorCheck[]> =>
  Effect.gen(function* () {
    const resolved = yield* loadInputs(services.configLoader, params);
    const inputCheck = yield* checkInput(resolved.inputs.inputFile);
    const pluginCheck = yield* checkPlugins(
      services.pluginLoader,
      services.pluginRegistry,
      resolved.inputs
    );
    const outputCheck = yield* checkOutput(
      resolved.inputs.outputDir,
      resolved.inputs.inputFile,
      params.currentWorkingDirectory
    );
    const effectCheck = yield* checkEffectReference();
    const formatterCheck = yield* checkFormatter(resolved.inputs.config.format);
    const workspaceEffectCheck = yield* checkWorkspaceEffectCompatibility(
      resolved.inputs.config,
      params.currentWorkingDirectory
    );
    const deepCheck = yield* checkDeepValidation(services.projectValidator, {
      inputs: resolved.inputs,
      prerequisiteChecks: [
        resolved.configCheck,
        inputCheck,
        pluginCheck,
        workspaceEffectCheck,
      ],
      deep: params.deep,
      currentWorkingDirectory: params.currentWorkingDirectory,
    });
    return [
      checkRuntime(),
      checkNodeVersion(),
      checkPackageManager(),
      resolved.configCheck,
      inputCheck,
      pluginCheck,
      outputCheck,
      effectCheck,
      formatterCheck,
      deepCheck,
      workspaceEffectCheck,
    ];
  });
