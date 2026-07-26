import { constants, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { Effect } from "effect";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import { detectRuntime, getRuntimeDisplayName } from "../runtime.js";
import { assertSafeCleanTarget } from "./cleanTargetGuard.js";
import type { DoctorCheck } from "../reports/DoctorReport.js";

const failureMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const isNotFoundError = (failure: unknown): boolean =>
  typeof failure === "object" &&
  failure !== null &&
  Reflect.get(failure, "code") === "ENOENT";

export const checkRuntime = (): DoctorCheck => {
  const runtime = detectRuntime();
  return createDoctorCheck({
    code: "TW-DOCTOR-001",
    name: "runtime detection",
    outcome: "pass",
    message: `Detected ${getRuntimeDisplayName(runtime)}.`,
  });
};

export const checkNodeVersion = (): DoctorCheck => {
  if (detectRuntime() !== "node") {
    return createDoctorCheck({
      code: "TW-DOCTOR-002",
      name: "Node.js version",
      outcome: "skip",
      message: "Node.js version is not applicable to this runtime.",
    });
  }

  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isInteger(major) && major >= 24
    ? createDoctorCheck({
        code: "TW-DOCTOR-002",
        name: "Node.js version",
        outcome: "pass",
        message: `Node.js ${version} satisfies the >=24 runtime contract.`,
      })
    : createDoctorCheck({
        code: "TW-DOCTOR-002",
        name: "Node.js version",
        outcome: "fail",
        message: `Node.js ${version} does not satisfy the >=24 runtime contract.`,
        hint: "Activate Node.js 24 or newer and rerun doctor.",
      });
};

export const checkPackageManager = (): DoctorCheck => {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent === undefined || userAgent.trim().length === 0) {
    return createDoctorCheck({
      code: "TW-DOCTOR-003",
      name: "package manager",
      outcome: "warn",
      message: "No package-manager user agent is available.",
      hint: "Run TypeWeaver through pnpm 10.34.5 for the repository-supported workflow.",
    });
  }

  const match = /^pnpm\/([^\s]+)/u.exec(userAgent);
  if (match?.[1] === "10.34.5") {
    return createDoctorCheck({
      code: "TW-DOCTOR-003",
      name: "package manager",
      outcome: "pass",
      message: "pnpm 10.34.5 matches the repository contract.",
    });
  }
  return createDoctorCheck({
    code: "TW-DOCTOR-003",
    name: "package manager",
    outcome: "warn",
    message: `Detected package-manager user agent '${userAgent}'.`,
    hint: "Use pnpm 10.34.5 for reproducible repository operations.",
  });
};

export const checkInput = (
  inputFile: string | undefined
): Effect.Effect<DoctorCheck> =>
  inputFile === undefined
    ? Effect.succeed(
        createDoctorCheck({
          code: "TW-DOCTOR-005",
          name: "spec input",
          outcome: "fail",
          message: "No spec input was resolved.",
          hint: "Pass --input or define input in the configuration.",
        })
      )
    : Effect.tryPromise({
        try: async () => {
          await fs.access(inputFile, constants.R_OK);
          const stats = await fs.stat(inputFile);
          if (!stats.isFile()) {
            throw new Error("The resolved input is not a file.");
          }
          return createDoctorCheck({
            code: "TW-DOCTOR-005",
            name: "spec input",
            outcome: "pass",
            message: `The spec input is readable: ${inputFile}.`,
          });
        },
        catch: cause =>
          createDoctorCheck({
            code: "TW-DOCTOR-005",
            name: "spec input",
            outcome: "fail",
            message: `The spec input is not readable: ${failureMessage(cause)}`,
            hint: "Pass a readable spec entrypoint with --input.",
          }),
      }).pipe(Effect.merge);

const nearestExistingDirectory = async (
  targetPath: string
): Promise<string> => {
  let candidate = targetPath;
  while (true) {
    try {
      const stats = await fs.stat(candidate);
      if (!stats.isDirectory()) {
        throw new Error(
          `The resolved output target is not a directory: ${candidate}.`
        );
      }
      return candidate;
    } catch (cause) {
      if (!isNotFoundError(cause)) {
        throw cause;
      }
      const parent = path.dirname(candidate);
      if (parent === candidate) {
        throw cause;
      }
      candidate = parent;
    }
  }
};

export const checkOutput = (
  outputDir: string | undefined,
  inputFile: string | undefined,
  cwd: string
): Effect.Effect<DoctorCheck> => {
  if (outputDir === undefined) {
    return Effect.succeed(
      createDoctorCheck({
        code: "TW-DOCTOR-007",
        name: "output target",
        outcome: "fail",
        message: "No output directory was resolved.",
        hint: "Pass --output or define output in the configuration.",
      })
    );
  }

  return Effect.tryPromise({
    try: async () => {
      assertSafeCleanTarget(outputDir, cwd, inputFile);
      const existingDirectory = await nearestExistingDirectory(outputDir);
      await fs.access(existingDirectory, constants.W_OK);
      return createDoctorCheck({
        code: "TW-DOCTOR-007",
        name: "output target",
        outcome: "pass",
        message: `The output target is safe and its nearest existing directory is writable: ${outputDir}.`,
      });
    },
    catch: cause =>
      createDoctorCheck({
        code: "TW-DOCTOR-007",
        name: "output target",
        outcome: "fail",
        message: failureMessage(cause),
        hint: "Choose a safe output below a writable project directory.",
      }),
  }).pipe(Effect.merge);
};

const readPackageVersion = async (specifier: string): Promise<string> => {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve(specifier);
  const parsed: unknown = JSON.parse(await fs.readFile(packagePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`${specifier} does not contain a package object.`);
  }
  const version = Reflect.get(parsed, "version");
  if (typeof version !== "string") {
    throw new Error(`${specifier} does not declare a version.`);
  }
  return version;
};

export const checkEffectReference = (): Effect.Effect<DoctorCheck> =>
  Effect.tryPromise({
    try: async () => {
      const version = await readPackageVersion("effect/package.json");
      const [major = Number.NaN, minor = Number.NaN] = version
        .split(".")
        .map(part => Number.parseInt(part, 10));
      if (major !== 3 || minor < 22) {
        return createDoctorCheck({
          code: "TW-DOCTOR-008",
          name: "Effect reference",
          outcome: "fail",
          message: `Effect ${version} is outside the supported >=3.22.0 <4 range.`,
          hint: "Install an Effect 3 release in the supported peer range.",
        });
      }
      return createDoctorCheck({
        code: "TW-DOCTOR-008",
        name: "Effect reference",
        outcome: "pass",
        message: `Effect ${version} satisfies the >=3.22.0 <4 contract.`,
      });
    },
    catch: cause =>
      createDoctorCheck({
        code: "TW-DOCTOR-008",
        name: "Effect reference",
        outcome: "fail",
        message: `Effect reference diagnostics failed: ${failureMessage(cause)}`,
        hint: "Install the declared Effect 3 peer dependency.",
      }),
  }).pipe(Effect.merge);

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
  }).pipe(Effect.merge);
};
