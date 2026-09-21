import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect } from "vitest";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const RULESET_CONTENT = "extends: spectral:oas\n";

export type PackageJsonWithBin = {
  readonly bin?: string | Record<string, string>;
};

export type OpenApiFixture = {
  readonly openapi?: unknown;
  readonly components?: unknown;
  readonly paths?: unknown;
};

export type ValidatorCommandOutput = {
  readonly stdout: string;
  readonly stderr: string;
};

export type ValidatorFinding = {
  readonly severity?: unknown;
};

export type ValidatorSummary = {
  readonly errors?: unknown;
  readonly error?: unknown;
  readonly total?: unknown;
};

export async function validateOpenApiFixture(
  fixturePath: string
): Promise<void> {
  const rulesetDirectory = await mkdtemp(
    join(tmpdir(), "typeweaver-openapi-ruleset-")
  );
  const rulesetPath = join(rulesetDirectory, "openapi-validity.yaml");

  await writeFile(rulesetPath, RULESET_CONTENT, "utf8");

  try {
    const output = await runOpenApiValidator(fixturePath, rulesetPath);

    assertValidatorOutputHasNoErrors(fixturePath, output.stdout);
  } finally {
    await rm(rulesetDirectory, { force: true, recursive: true });
  }
}

export function assertFixtureExists(fixturePath: string): void {
  if (!existsSync(fixturePath)) {
    throw new Error(
      `Missing generated OpenAPI fixture at ${fixturePath}. Run ` +
        "`pnpm --filter test-utils test:gen` to regenerate it."
    );
  }
}

export async function runOpenApiValidator(
  fixturePath: string,
  rulesetPath: string
): Promise<ValidatorCommandOutput> {
  const args = validatorArgs(fixturePath, rulesetPath);
  const cliPath = resolveSpectralCliPath();

  try {
    if (cliPath !== undefined) {
      return stringifyExecFileOutput(
        await execFileAsync(process.execPath, [cliPath, ...args], {
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          timeout: 30_000,
        })
      );
    }

    return stringifyExecFileOutput(
      await execFileAsync("pnpm", ["exec", "spectral", ...args], {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30_000,
      })
    );
  } catch (error) {
    const output = commandOutput(error);
    throw new Error(
      `Spectral rejected ${fixturePath}\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
      { cause: error }
    );
  }
}

export function validatorArgs(
  fixturePath: string,
  rulesetPath: string
): readonly string[] {
  return [
    "lint",
    "--format",
    "json",
    "--ruleset",
    rulesetPath,
    "--fail-severity",
    "error",
    fixturePath,
  ];
}

export function assertValidatorOutputHasNoErrors(
  fixturePath: string,
  stdout: string
): void {
  const parsedOutput = parseValidatorOutput(fixturePath, stdout);

  if (parsedOutput === undefined) {
    return;
  }

  const errorFindings = validatorFindings(parsedOutput).filter(isErrorFinding);
  expect(errorFindings, validatorFailureMessage(fixturePath, stdout)).toEqual(
    []
  );

  const summaryErrorCount = validatorSummaryErrorCount(parsedOutput);
  if (summaryErrorCount !== undefined) {
    expect(
      summaryErrorCount,
      validatorFailureMessage(fixturePath, stdout)
    ).toBe(0);
  }
}

export function parseValidatorOutput(
  fixturePath: string,
  stdout: string
): unknown | undefined {
  const trimmedStdout = stdout.trim();

  if (trimmedStdout === "") {
    return undefined;
  }

  try {
    return JSON.parse(trimmedStdout) as unknown;
  } catch (error) {
    throw new Error(
      `Spectral returned non-JSON output for ${fixturePath}\nstdout:\n${stdout}`,
      { cause: error }
    );
  }
}

export function validatorFindings(
  output: unknown
): readonly ValidatorFinding[] {
  if (Array.isArray(output)) {
    return output.filter(isValidatorFinding);
  }

  if (!isRecord(output)) {
    return [];
  }

  const results = output["results"];

  if (Array.isArray(results)) {
    return results.filter(isValidatorFinding);
  }

  const errors = output["errors"];

  return Array.isArray(errors) ? errors.filter(isValidatorFinding) : [];
}

export function validatorSummaryErrorCount(
  output: unknown
): number | undefined {
  if (!isRecord(output) || !isRecord(output["summary"])) {
    return undefined;
  }

  const summary = output["summary"] as ValidatorSummary;
  const errorCount = numericSummaryValue(summary.errors ?? summary.error);

  return errorCount ?? numericSummaryValue(summary.total);
}

export function numericSummaryValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function isErrorFinding(finding: ValidatorFinding): boolean {
  return finding.severity === 0 || finding.severity === "error";
}

export function isValidatorFinding(value: unknown): value is ValidatorFinding {
  return isRecord(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validatorFailureMessage(
  fixturePath: string,
  stdout: string
): string {
  return `Spectral reported OpenAPI validity errors for ${fixturePath}\nstdout:\n${stdout}`;
}

export function resolveSpectralCliPath(): string | undefined {
  try {
    const packageJsonPath =
      require.resolve("@stoplight/spectral-cli/package.json");
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf8")
    ) as PackageJsonWithBin;
    const binPath = spectralBinPath(packageJson);

    return binPath === undefined
      ? undefined
      : resolve(dirname(packageJsonPath), binPath);
  } catch {
    return undefined;
  }
}

export function spectralBinPath(
  packageJson: PackageJsonWithBin
): string | undefined {
  if (typeof packageJson.bin === "string") {
    return packageJson.bin;
  }

  return packageJson.bin?.["spectral"];
}

export function commandOutput(error: unknown): {
  readonly stdout: string;
  readonly stderr: string;
} {
  if (typeof error !== "object" || error === null) {
    return { stdout: "", stderr: String(error) };
  }

  const output = error as {
    readonly stdout?: unknown;
    readonly stderr?: unknown;
  };

  return {
    stdout: stringifyCommandOutput(output.stdout),
    stderr: stringifyCommandOutput(output.stderr),
  };
}

export function stringifyExecFileOutput(output: {
  readonly stdout: unknown;
  readonly stderr: unknown;
}): ValidatorCommandOutput {
  return {
    stdout: stringifyCommandOutput(output.stdout),
    stderr: stringifyCommandOutput(output.stderr),
  };
}

export function stringifyCommandOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return value === undefined ? "" : String(value);
}
