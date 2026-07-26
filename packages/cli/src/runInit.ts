import path from "node:path";
import { Effect, Either, Option } from "effect";
import { createInitReport, renderInitReport } from "./reports/InitReport.js";
import { ProjectInitializer } from "./services/ProjectInitializer.js";
import type { InitDiagnostic, InitReport } from "./reports/InitReport.js";
import type { InitConfigFormat } from "./services/ProjectInitializer.js";

export type InitHandlerInput = {
  readonly target: string;
  readonly force: Option.Option<boolean>;
  readonly "dry-run": Option.Option<boolean>;
  readonly "config-format": Option.Option<InitConfigFormat>;
  readonly json: Option.Option<boolean>;
};

export type InitHandlerConfig = {
  readonly currentWorkingDirectory: string;
  readonly templateDir: string;
  readonly typeweaverVersion: string;
  readonly zodVersion: string;
};

const failureDiagnostic = (failure: unknown): InitDiagnostic => {
  const tag =
    typeof failure === "object" &&
    failure !== null &&
    typeof Reflect.get(failure, "_tag") === "string"
      ? String(Reflect.get(failure, "_tag"))
      : "";
  const details = new Map<string, Pick<InitDiagnostic, "code" | "hint">>([
    [
      "InitTargetNotEmptyError",
      {
        code: "TW-INIT-001",
        hint: "Choose an empty target or pass --force to overwrite only conflicting starter files.",
      },
    ],
    [
      "InitTargetNotDirectoryError",
      {
        code: "TW-INIT-002",
        hint: "Verify the target path and filesystem permissions, then retry.",
      },
    ],
    [
      "InvalidInitPackageError",
      {
        code: "TW-INIT-003",
        hint: "Fix the existing package.json before initializing.",
      },
    ],
    [
      "InitFileConflictError",
      {
        code: "TW-INIT-004",
        hint: "Pass --force only if overwriting this starter file is intentional.",
      },
    ],
  ]).get(tag) ?? {
    code: "TW-INIT-005",
    hint: "Verify the target path and filesystem permissions, then retry.",
  };
  return {
    code: details.code,
    message: failure instanceof Error ? failure.message : String(failure),
    hint: details.hint,
  };
};

const writeReport = (report: InitReport, json: boolean) =>
  Effect.sync(() => {
    const output = json
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderInitReport(report);
    const stream = json || report.success ? process.stdout : process.stderr;
    stream.write(output);
    if (!report.success) {
      process.exitCode = 1;
    }
  });

const failedReport = (
  args: InitHandlerInput,
  config: InitHandlerConfig,
  failure: unknown
): InitReport => {
  const format = Option.getOrElse(
    args["config-format"],
    (): InitConfigFormat => "mjs"
  );
  return createInitReport({
    version: 1,
    command: "init",
    success: false,
    status: "failed",
    dryRun: Option.getOrElse(args["dry-run"], () => false),
    targetDir: path.resolve(config.currentWorkingDirectory, args.target),
    configFile: `typeweaver.config.${format}`,
    files: [],
    overwrittenFiles: [],
    preservedFiles: [],
    nextSteps: [],
    diagnostics: [failureDiagnostic(failure)],
  });
};

export const runInit = (args: InitHandlerInput, config: InitHandlerConfig) =>
  Effect.gen(function* () {
    const outcome = yield* ProjectInitializer.initialize({
      targetDir: args.target,
      currentWorkingDirectory: config.currentWorkingDirectory,
      templateDir: config.templateDir,
      typeweaverVersion: config.typeweaverVersion,
      zodVersion: config.zodVersion,
      configFormat: Option.getOrUndefined(args["config-format"]),
      force: Option.getOrElse(args.force, () => false),
      dryRun: Option.getOrElse(args["dry-run"], () => false),
    }).pipe(Effect.either);
    const report = Either.isRight(outcome)
      ? createInitReport({
          version: 1,
          command: "init",
          success: true,
          status: outcome.right.dryRun ? "planned" : "created",
          dryRun: outcome.right.dryRun,
          targetDir: outcome.right.targetDir,
          configFile: outcome.right.configFile,
          files: [...outcome.right.files],
          overwrittenFiles: [...outcome.right.overwrittenFiles],
          preservedFiles: [...outcome.right.preservedFiles],
          nextSteps: [...outcome.right.nextSteps],
          diagnostics: [],
        })
      : failedReport(args, config, outcome.left);
    yield* writeReport(report, Option.isSome(args.json) && args.json.value);
  });
