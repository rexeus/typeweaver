import { Effect, Option } from "effect";
import {
  createDoctorReport,
  renderDoctorReport,
} from "./reports/DoctorReport.js";
import { ProjectDoctor } from "./services/ProjectDoctor.js";

export type DoctorHandlerInput = {
  readonly input: Option.Option<string>;
  readonly output: Option.Option<string>;
  readonly config: Option.Option<string>;
  readonly plugins: Option.Option<string>;
  readonly deep: Option.Option<boolean>;
  readonly json: Option.Option<boolean>;
};

const writeReport = (
  report: ReturnType<typeof createDoctorReport>,
  json: boolean
) =>
  Effect.sync(() => {
    const output = json
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderDoctorReport(report);
    process.stdout.write(output);
    if (!report.healthy) {
      process.exitCode = 1;
    }
  });

export const runDoctor = (args: DoctorHandlerInput) =>
  Effect.gen(function* () {
    const checks = yield* ProjectDoctor.diagnose({
      currentWorkingDirectory: process.cwd(),
      input: Option.getOrUndefined(args.input),
      output: Option.getOrUndefined(args.output),
      configPath: Option.getOrUndefined(args.config),
      plugins: Option.getOrUndefined(args.plugins),
      deep: Option.getOrElse(args.deep, () => false),
    });
    const report = createDoctorReport(checks);
    yield* writeReport(report, Option.isSome(args.json) && args.json.value);
  });
