import type {
  Issue,
  PluginRegistryShape,
  TypeweaverConfig,
} from "@rexeus/typeweaver-gen";
import { Effect, Result } from "effect";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import {
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
} from "./generatorDefaults.js";
import type { PluginLoaderShape } from "./PluginLoaderService.js";
import type {
  DeepValidationParams,
  DoctorInputs,
} from "./projectDoctorTypes.js";
import type { ProjectValidatorShape } from "./ProjectValidator.js";

const failureMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

export const checkPlugins = (
  pluginLoader: PluginLoaderShape,
  pluginRegistry: PluginRegistryShape,
  inputs: DoctorInputs
): Effect.Effect<ReturnType<typeof createDoctorCheck>> => {
  if (!inputs.configHealthy) {
    return Effect.succeed(
      createDoctorCheck({
        code: "TW-DOCTOR-006",
        name: "plugin availability",
        outcome: "skip",
        message: "Plugin checks depend on a valid configuration.",
      })
    );
  }
  return Effect.gen(function* () {
    const registry = yield* pluginRegistry.createInstance();
    const loaded = yield* pluginLoader
      .loadAll({
        registry,
        requiredPlugins: defaultRequiredPlugins(),
        strategies: DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
        config: inputs.config,
      })
      .pipe(Effect.result);
    if (Result.isFailure(loaded)) {
      return createDoctorCheck({
        code: "TW-DOCTOR-006",
        name: "plugin availability",
        outcome: "fail",
        message: failureMessage(loaded.failure),
        hint: "Verify each plugin specifier and its configuration.",
      });
    }
    const pluginCount = inputs.config.plugins?.length ?? 0;
    return createDoctorCheck({
      code: "TW-DOCTOR-006",
      name: "plugin availability",
      outcome: "pass",
      message: `${pluginCount} configured plugin(s) and required plugins are available.`,
    });
  });
};

const issueOutcome = (issues: readonly Issue[]) => {
  if (issues.some(issue => issue.severity === "error")) return "fail" as const;
  if (issues.some(issue => issue.severity === "warning"))
    return "warn" as const;
  return "pass" as const;
};

const skippedDeepCheck = (message: string) =>
  createDoctorCheck({
    code: "TW-DOCTOR-010",
    name: "deep spec validation",
    outcome: "skip",
    message,
  });

export const checkDeepValidation = (
  projectValidator: ProjectValidatorShape,
  params: DeepValidationParams
): Effect.Effect<ReturnType<typeof createDoctorCheck>> => {
  if (!params.deep)
    return Effect.succeed(
      skippedDeepCheck("Deep validation was not requested.")
    );
  if (params.prerequisiteChecks.some(check => check.outcome === "fail")) {
    return Effect.succeed(
      skippedDeepCheck(
        "Deep validation depends on valid configuration, input, plugins, and workspace Effect compatibility."
      )
    );
  }
  if (params.inputs.inputFile === undefined) {
    return Effect.succeed(
      skippedDeepCheck("Deep validation requires a resolved spec input.")
    );
  }
  const inputFile = params.inputs.inputFile;
  const config: Partial<TypeweaverConfig> & { readonly input: string } = {
    ...params.inputs.config,
    input: inputFile,
  };
  return Effect.gen(function* () {
    const result = yield* projectValidator
      .validate({
        inputFile,
        config,
        currentWorkingDirectory: params.currentWorkingDirectory,
      })
      .pipe(Effect.result);
    if (Result.isFailure(result)) {
      return createDoctorCheck({
        code: "TW-DOCTOR-010",
        name: "deep spec validation",
        outcome: "fail",
        message: failureMessage(result.failure),
        hint: "Fix the spec bundle, normalized contract, or plugin validation failure.",
      });
    }
    const outcome = issueOutcome(result.success.issues);
    return createDoctorCheck({
      code: "TW-DOCTOR-010",
      name: "deep spec validation",
      outcome,
      message: `Deep validation completed with ${result.success.issues.length} issue(s).`,
      ...(outcome === "pass"
        ? {}
        : {
            hint: "Run typeweaver validate for the complete structured issue report.",
          }),
    });
  });
};
