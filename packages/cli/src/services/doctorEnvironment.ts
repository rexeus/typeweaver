import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { Effect } from "effect";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import { REQUIRED_EFFECT_VERSION } from "./effectCompatibility.js";
import type { DoctorCheck } from "../reports/DoctorReport.js";

const failureMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const readPackageVersion = async (specifier: string): Promise<string> => {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve(specifier);
  const parsed: unknown = JSON.parse(await fs.readFile(packagePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`${specifier} does not contain a package object.`);
  }
  const version: unknown = Reflect.get(parsed, "version");
  if (typeof version !== "string") {
    throw new Error(`${specifier} does not declare a version.`);
  }
  return version;
};

// TW-DOCTOR-008 reports the Effect runtime bundled with this CLI entrypoint,
// resolved from the CLI's own module location. The consumer project's Effect
// major is a separate question and belongs to TW-DOCTOR-011.
export const checkEffectReference = (): Effect.Effect<DoctorCheck> =>
  Effect.tryPromise({
    try: async () => {
      const version = await readPackageVersion("effect/package.json");
      return version !== REQUIRED_EFFECT_VERSION
        ? createDoctorCheck({
            code: "TW-DOCTOR-008",
            name: "CLI Effect runtime",
            outcome: "fail",
            message: `The TypeWeaver CLI resolves its own Effect ${version}, outside the exact ${REQUIRED_EFFECT_VERSION} pin.`,
            hint: `Reinstall the CLI so its bundled Effect ${REQUIRED_EFFECT_VERSION} dependency resolves.`,
          })
        : createDoctorCheck({
            code: "TW-DOCTOR-008",
            name: "CLI Effect runtime",
            outcome: "pass",
            message: `The TypeWeaver CLI resolves its own Effect ${version}, matching the exact ${REQUIRED_EFFECT_VERSION} contract.`,
          });
    },
    catch: cause =>
      createDoctorCheck({
        code: "TW-DOCTOR-008",
        name: "CLI Effect runtime",
        outcome: "fail",
        message: `The TypeWeaver CLI could not resolve its own Effect runtime: ${failureMessage(cause)}`,
        hint: "Reinstall the CLI so its bundled Effect dependency resolves.",
      }),
  }).pipe(Effect.catch(check => Effect.succeed(check)));

export const checkFormatter = (
  format: boolean | undefined
): Effect.Effect<DoctorCheck> => {
  if (format === false) {
    return Effect.succeed(
      createDoctorCheck({
        code: "TW-DOCTOR-009",
        name: "formatter availability",
        outcome: "skip",
        message: "Formatting is disabled by configuration.",
      })
    );
  }

  return Effect.tryPromise({
    try: async () => {
      const formatter: unknown = await import("oxfmt");
      if (
        typeof formatter !== "object" ||
        formatter === null ||
        typeof Reflect.get(formatter, "format") !== "function"
      ) {
        throw new Error("oxfmt does not export a format function.");
      }
      return createDoctorCheck({
        code: "TW-DOCTOR-009",
        name: "formatter availability",
        outcome: "pass",
        message: "The optional oxfmt formatter is available.",
      });
    },
    catch: cause =>
      createDoctorCheck({
        code: "TW-DOCTOR-009",
        name: "formatter availability",
        outcome: "warn",
        message: `The optional formatter is unavailable: ${failureMessage(cause)}`,
        hint: "Install oxfmt or set format to false.",
      }),
  }).pipe(Effect.catch(check => Effect.succeed(check)));
};
