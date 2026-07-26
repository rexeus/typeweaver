import path from "node:path";
import { PluginRegistry } from "@rexeus/typeweaver-gen";
import type { Issue, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Either } from "effect";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import { parsePluginList } from "../resolveGenerateOptions.js";
import { ConfigLoader, getResolvedConfigPath } from "./ConfigLoader.js";
import {
  checkEffectReference,
  checkFormatter,
  checkInput,
  checkNodeVersion,
  checkOutput,
  checkPackageManager,
  checkRuntime,
} from "./doctorEnvironment.js";
import {
  DEFAULT_PLUGIN_RESOLUTION_STRATEGIES,
  defaultRequiredPlugins,
} from "./generatorDefaults.js";
import { PluginLoader } from "./PluginLoader.js";
import { ProjectValidator } from "./ProjectValidator.js";
import type { DoctorCheck, DoctorOutcome } from "../reports/DoctorReport.js";

export type DiagnoseProjectParams = {
  readonly currentWorkingDirectory: string;
  readonly input?: string;
  readonly output?: string;
  readonly configPath?: string;
  readonly plugins?: string;
  readonly deep: boolean;
};

type DoctorInputs = {
  readonly config: Partial<TypeweaverConfig>;
  readonly configHealthy: boolean;
  readonly inputFile?: string;
  readonly outputDir?: string;
};

type ResolvedDoctorInputs = {
  readonly inputs: DoctorInputs;
  readonly configCheck: DoctorCheck;
};

type DeepValidationParams = {
  readonly inputs: DoctorInputs;
  readonly prerequisiteChecks: readonly DoctorCheck[];
  readonly deep: boolean;
  readonly currentWorkingDirectory: string;
};

const failureMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const resolveOptionalPath = (
  value: string | undefined,
  currentWorkingDirectory: string
): string | undefined =>
  value === undefined
    ? undefined
    : path.isAbsolute(value)
      ? value
      : path.resolve(currentWorkingDirectory, value);

const issueOutcome = (issues: readonly Issue[]): DoctorOutcome => {
  if (issues.some(issue => issue.severity === "error")) return "fail";
  if (issues.some(issue => issue.severity === "warning")) return "warn";
  return "pass";
};

const loadConfig = (
  configLoader: ConfigLoader,
  params: DiagnoseProjectParams
): Effect.Effect<{
  readonly config: Partial<TypeweaverConfig>;
  readonly healthy: boolean;
  readonly check: DoctorCheck;
}> => {
  if (params.configPath === undefined) {
    return Effect.succeed({
      config: {},
      healthy: true,
      check: createDoctorCheck({
        code: "TW-DOCTOR-004",
        name: "configuration",
        outcome: "skip",
        message: "No explicit configuration file was requested.",
      }),
    });
  }

  const resolvedConfigPath = getResolvedConfigPath(
    params.configPath,
    params.currentWorkingDirectory
  );
  return Effect.gen(function* () {
    const loaded = yield* configLoader
      .load(resolvedConfigPath)
      .pipe(Effect.either);
    return Either.isRight(loaded)
      ? {
          config: loaded.right,
          healthy: true,
          check: createDoctorCheck({
            code: "TW-DOCTOR-004",
            name: "configuration",
            outcome: "pass",
            message: `Loaded ${resolvedConfigPath}.`,
          }),
        }
      : {
          config: {},
          healthy: false,
          check: createDoctorCheck({
            code: "TW-DOCTOR-004",
            name: "configuration",
            outcome: "fail",
            message: failureMessage(loaded.left),
            hint: "Provide a readable .js, .mjs, or .cjs TypeWeaver configuration.",
          }),
        };
  });
};

const loadInputs = (
  configLoader: ConfigLoader,
  params: DiagnoseProjectParams
): Effect.Effect<ResolvedDoctorInputs> =>
  Effect.gen(function* () {
    const loaded = yield* loadConfig(configLoader, params);
    const input = params.input ?? loaded.config.input;
    const output = params.output ?? loaded.config.output;
    const config: Partial<TypeweaverConfig> = {
      ...loaded.config,
      ...(input === undefined
        ? {}
        : {
            input: resolveOptionalPath(input, params.currentWorkingDirectory),
          }),
      ...(output === undefined
        ? {}
        : {
            output: resolveOptionalPath(output, params.currentWorkingDirectory),
          }),
      ...(params.plugins === undefined
        ? {}
        : { plugins: parsePluginList(params.plugins) }),
    };
    return {
      inputs: {
        config,
        configHealthy: loaded.healthy,
        ...(config.input === undefined ? {} : { inputFile: config.input }),
        ...(config.output === undefined ? {} : { outputDir: config.output }),
      },
      configCheck: loaded.check,
    };
  });

const checkPlugins = (
  pluginLoader: PluginLoader,
  pluginRegistry: PluginRegistry,
  inputs: DoctorInputs
): Effect.Effect<DoctorCheck> => {
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
      .pipe(Effect.either);
    if (Either.isLeft(loaded)) {
      return createDoctorCheck({
        code: "TW-DOCTOR-006",
        name: "plugin availability",
        outcome: "fail",
        message: failureMessage(loaded.left),
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

const skippedDeepCheck = (message: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-010",
    name: "deep spec validation",
    outcome: "skip",
    message,
  });

const checkDeepValidation = (
  projectValidator: ProjectValidator,
  params: DeepValidationParams
): Effect.Effect<DoctorCheck> => {
  if (!params.deep) {
    return Effect.succeed(
      skippedDeepCheck("Deep validation was not requested.")
    );
  }
  if (
    params.prerequisiteChecks.some(candidate => candidate.outcome === "fail")
  ) {
    return Effect.succeed(
      skippedDeepCheck(
        "Deep validation depends on valid configuration, input, and plugins."
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
      .pipe(Effect.either);
    if (Either.isLeft(result)) {
      return createDoctorCheck({
        code: "TW-DOCTOR-010",
        name: "deep spec validation",
        outcome: "fail",
        message: failureMessage(result.left),
        hint: "Fix the spec bundle, normalized contract, or plugin validation failure.",
      });
    }

    const outcome = issueOutcome(result.right.issues);
    return createDoctorCheck({
      code: "TW-DOCTOR-010",
      name: "deep spec validation",
      outcome,
      message: `Deep validation completed with ${result.right.issues.length} issue(s).`,
      ...(outcome === "pass"
        ? {}
        : {
            hint: "Run typeweaver validate for the complete structured issue report.",
          }),
    });
  });
};

const diagnoseProject = (
  services: {
    readonly configLoader: ConfigLoader;
    readonly pluginLoader: PluginLoader;
    readonly pluginRegistry: PluginRegistry;
    readonly projectValidator: ProjectValidator;
  },
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
    const deepCheck = yield* checkDeepValidation(services.projectValidator, {
      inputs: resolved.inputs,
      prerequisiteChecks: [resolved.configCheck, inputCheck, pluginCheck],
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
    ];
  });

export class ProjectDoctor extends Effect.Service<ProjectDoctor>()(
  "typeweaver/ProjectDoctor",
  {
    effect: Effect.gen(function* () {
      const configLoader = yield* ConfigLoader;
      const pluginLoader = yield* PluginLoader;
      const pluginRegistry = yield* PluginRegistry;
      const projectValidator = yield* ProjectValidator;
      const services = {
        configLoader,
        pluginLoader,
        pluginRegistry,
        projectValidator,
      };
      return {
        diagnose: Effect.fn("typeweaver.ProjectDoctor.diagnose")(
          (params: DiagnoseProjectParams) => diagnoseProject(services, params)
        ),
      } as const;
    }),
    dependencies: [
      ConfigLoader.Default,
      PluginLoader.Default,
      PluginRegistry.Default,
      ProjectValidator.Default,
    ],
    accessors: true,
  }
) {}
