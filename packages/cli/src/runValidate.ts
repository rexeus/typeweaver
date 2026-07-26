import path from "node:path";
import { normalizationErrorToIssue } from "@rexeus/typeweaver-gen";
import type { Issue, Severity, TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Either, Option } from "effect";
import { MissingGenerateOptionError } from "./errors/MissingGenerateOptionError.js";
import {
  createValidationReport,
  renderValidationReport,
} from "./reports/ValidationReport.js";
import { parsePluginList } from "./resolveGenerateOptions.js";
import {
  ConfigLoader,
  getResolvedConfigPath,
} from "./services/ConfigLoader.js";
import { ProjectValidator } from "./services/ProjectValidator.js";

export type ValidateHandlerInput = {
  readonly input: Option.Option<string>;
  readonly config: Option.Option<string>;
  readonly plugins: Option.Option<string>;
  readonly strict: Option.Option<boolean>;
  readonly "fail-on": Option.Option<Severity>;
  readonly json: Option.Option<boolean>;
};

const CONFIG_FAILURE_TAGS = new Set([
  "ConfigModuleEvaluationError",
  "InvalidConfigExportError",
  "InvalidConfigValueError",
  "MissingGenerateOptionError",
  "UnsupportedConfigExtensionError",
  "UnsupportedTypeScriptConfigError",
]);

const PLUGIN_FAILURE_TAGS = new Set([
  "PluginConfigError",
  "PluginDependencyError",
  "PluginExecutionError",
  "PluginLoadError",
]);

const isTaggedFailure = (value: unknown): value is { readonly _tag: string } =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  typeof value._tag === "string";

const messageFromFailure = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const failureToIssue = (failure: unknown): Issue => {
  const normalized = normalizationErrorToIssue(failure);
  if (normalized !== undefined) {
    return normalized;
  }

  const tag = isTaggedFailure(failure) ? failure._tag : "";
  const code = CONFIG_FAILURE_TAGS.has(tag)
    ? "TW-CLI-001"
    : PLUGIN_FAILURE_TAGS.has(tag)
      ? "TW-CLI-003"
      : "TW-CLI-002";
  return {
    code,
    severity: "error",
    message: messageFromFailure(failure),
    path: "",
    hint:
      code === "TW-CLI-001"
        ? "Provide a supported config and an input path."
        : code === "TW-CLI-003"
          ? "Verify the plugin specifier, configuration, and validation hook."
          : "Verify that the spec entrypoint exists, bundles, and exports a valid spec.",
    fixable: false,
  };
};

const thresholdFrom = (args: ValidateHandlerInput): Severity => {
  if (Option.isSome(args.strict) && args.strict.value) {
    return "warning";
  }
  return Option.getOrElse(args["fail-on"], () => "error");
};

const resolveValidation = (args: ValidateHandlerInput, cwd: string) =>
  Effect.gen(function* () {
    let loadedConfig: Partial<TypeweaverConfig> = {};
    if (Option.isSome(args.config)) {
      loadedConfig = yield* ConfigLoader.load(
        getResolvedConfigPath(args.config.value, cwd)
      );
    }

    const input = Option.getOrUndefined(args.input) ?? loadedConfig.input;
    if (input === undefined) {
      return yield* new MissingGenerateOptionError({
        optionName: "input",
        flag: "--input",
        configKey: "input",
      });
    }

    const inputFile = path.isAbsolute(input) ? input : path.resolve(cwd, input);
    const config: Partial<TypeweaverConfig> & { readonly input: string } = {
      ...loadedConfig,
      input: inputFile,
      ...(Option.isSome(args.plugins)
        ? { plugins: parsePluginList(args.plugins.value) }
        : {}),
    };
    return yield* ProjectValidator.validate({
      inputFile,
      config,
      currentWorkingDirectory: cwd,
    });
  });

const writeReport = (
  report: ReturnType<typeof createValidationReport>,
  json: boolean
) =>
  Effect.sync(() => {
    const output = json
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderValidationReport(report);
    const stream = json || report.valid ? process.stdout : process.stderr;
    stream.write(output);
    if (!report.valid) {
      process.exitCode = 1;
    }
  });

export const runValidate = (args: ValidateHandlerInput) =>
  Effect.gen(function* () {
    const outcome = yield* Effect.either(
      resolveValidation(args, process.cwd())
    );
    const issues: readonly Issue[] = Either.isRight(outcome)
      ? outcome.right.issues
      : [failureToIssue(outcome.left)];
    const report = createValidationReport(issues, thresholdFrom(args));
    yield* writeReport(report, Option.isSome(args.json) && args.json.value);
  });
