import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Result } from "effect";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import { parsePluginList } from "../resolveGenerateOptions.js";
import { getResolvedConfigPath } from "./ConfigLoader.js";
import type { ConfigLoaderShape } from "./ConfigLoader.js";
import type {
  DiagnoseProjectParams,
  ResolvedDoctorInputs,
} from "./projectDoctorTypes.js";

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

/**
 * Drops keys whose value is `undefined` so a merged configuration can be
 * assigned under `exactOptionalPropertyTypes`, where an explicit `undefined`
 * is not assignable to an optional property.
 */
const withoutUndefinedValues = (
  config: Record<string, unknown>
): Partial<TypeweaverConfig> => {
  const result: Partial<TypeweaverConfig> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
};

const loadConfig = (
  configLoader: ConfigLoaderShape,
  params: DiagnoseProjectParams
): Effect.Effect<{
  readonly config: Partial<TypeweaverConfig>;
  readonly healthy: boolean;
  readonly check: ReturnType<typeof createDoctorCheck>;
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
      .pipe(Effect.result);
    return Result.isSuccess(loaded)
      ? {
          config: loaded.success,
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
            message: failureMessage(loaded.failure),
            hint: "Provide a readable .js, .mjs, or .cjs TypeWeaver configuration.",
          }),
        };
  });
};

export const loadInputs = (
  configLoader: ConfigLoaderShape,
  params: DiagnoseProjectParams
): Effect.Effect<ResolvedDoctorInputs> =>
  Effect.gen(function* () {
    const loaded = yield* loadConfig(configLoader, params);
    const input = params.input ?? loaded.config.input;
    const output = params.output ?? loaded.config.output;
    const config = withoutUndefinedValues({
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
    });
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
