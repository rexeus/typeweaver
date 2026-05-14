import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../test-utils/src/test-project/output/openapi/openapi.json"
);

const RULESET_CONTENT = "extends: spectral:oas\n";

type PackageJsonWithBin = {
  readonly bin?: string | Record<string, string>;
};

type OpenApiFixture = {
  readonly openapi?: unknown;
  readonly components?: unknown;
  readonly paths?: unknown;
};

type ValidatorCommandOutput = {
  readonly stdout: string;
  readonly stderr: string;
};

type ValidatorFinding = {
  readonly severity?: unknown;
};

type ValidatorSummary = {
  readonly errors?: unknown;
  readonly error?: unknown;
  readonly total?: unknown;
};

describe("generated OpenAPI fixture", () => {
  test("validates the committed test-utils fixture as an OpenAPI document", async () => {
    assertFixtureExists(FIXTURE_PATH);
    const fixture = JSON.parse(
      readFileSync(FIXTURE_PATH, "utf8")
    ) as OpenApiFixture;

    expect(fixture.openapi).toBe("3.1.1");
    const schemas = componentsSchemas(fixture);

    expect(
      requestBodySchemaAt(fixture, "/todos/{todoId}/status", "put"),
      "UpdateTodoStatus request body should reference a component schema"
    ).toEqual({ $ref: "#/components/schemas/UpdateTodoStatusRequestBody" });
    expect(
      schemas.UpdateTodoStatusRequestBody,
      "UpdateTodoStatusRequestBody component should exist for the request body ref"
    ).toEqual({
      type: "object",
      properties: {
        value: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
        },
      },
      required: ["value"],
      additionalProperties: false,
    });
    expect(
      responseSchemaAt(fixture, "/todos/{todoId}/status", "put", "409"),
      "UpdateTodoStatus 409 should merge duplicate-status bodies as oneOf refs"
    ).toEqual({
      oneOf: [
        { $ref: "#/components/schemas/TodoStatusTransitionInvalidErrorBody" },
        { $ref: "#/components/schemas/TodoNotChangeableErrorBody" },
      ],
    });
    expect(
      schemas.TodoStatusTransitionInvalidErrorBody,
      "TodoStatusTransitionInvalidErrorBody component should exist for the 409 oneOf ref"
    ).toMatchObject({
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: ["Todo status transition is conflicting with current status"],
        },
        code: {
          type: "string",
          enum: ["TODO_STATUS_TRANSITION_INVALID_ERROR"],
        },
      },
    });
    expect(
      schemas.TodoNotChangeableErrorBody,
      "TodoNotChangeableErrorBody component should exist for the 409 oneOf ref"
    ).toMatchObject({
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: ["Todo in current status cannot be changed"],
        },
        code: { type: "string", enum: ["TODO_NOT_CHANGEABLE_ERROR"] },
      },
    });
    await validateOpenApiFixture(FIXTURE_PATH);
  });
});

function componentsSchemas(fixture: OpenApiFixture): Record<string, unknown> {
  if (!isRecord(fixture.components)) {
    throw new Error("Fixture is missing components.");
  }

  const schemas = fixture.components.schemas;

  if (!isRecord(schemas) || Object.keys(schemas).length === 0) {
    throw new Error("Fixture is missing non-empty components.schemas.");
  }

  return schemas;
}

function requestBodySchemaAt(
  fixture: OpenApiFixture,
  path: string,
  method: string
): unknown {
  if (!isRecord(fixture.paths)) {
    return undefined;
  }

  const pathItem = fixture.paths[path];
  if (!isRecord(pathItem)) {
    return undefined;
  }

  const operation = pathItem[method];
  if (!isRecord(operation) || !isRecord(operation.requestBody)) {
    return undefined;
  }

  const requestBody = operation.requestBody;
  if (!isRecord(requestBody.content)) {
    return undefined;
  }

  const mediaType = requestBody.content["application/json"];

  return isRecord(mediaType) ? mediaType.schema : undefined;
}

function responseSchemaAt(
  fixture: OpenApiFixture,
  path: string,
  method: string,
  statusCode: string
): unknown {
  if (!isRecord(fixture.paths)) {
    return undefined;
  }

  const pathItem = fixture.paths[path];
  if (!isRecord(pathItem)) {
    return undefined;
  }

  const operation = pathItem[method];
  if (!isRecord(operation) || !isRecord(operation.responses)) {
    return undefined;
  }

  const response = operation.responses[statusCode];
  if (!isRecord(response) || !isRecord(response.content)) {
    return undefined;
  }

  const mediaType = response.content["application/json"];

  return isRecord(mediaType) ? mediaType.schema : undefined;
}

async function validateOpenApiFixture(fixturePath: string): Promise<void> {
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

function assertFixtureExists(fixturePath: string): void {
  if (!existsSync(fixturePath)) {
    throw new Error(
      `Missing generated OpenAPI fixture at ${fixturePath}. Run ` +
        "`pnpm --filter test-utils test:gen` to regenerate it."
    );
  }
}

async function runOpenApiValidator(
  fixturePath: string,
  rulesetPath: string
): Promise<ValidatorCommandOutput> {
  const args = validatorArgs(fixturePath, rulesetPath);
  const cliPath = resolveLintOpenApiCliPath();

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
      await execFileAsync("pnpm", ["exec", "lint-openapi", ...args], {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30_000,
      })
    );
  } catch (error) {
    const output = commandOutput(error);
    throw new Error(
      `IBM OpenAPI Validator rejected ${fixturePath}\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`,
      { cause: error }
    );
  }
}

function validatorArgs(
  fixturePath: string,
  rulesetPath: string
): readonly string[] {
  return ["--json", "--ruleset", rulesetPath, "--no-colors", fixturePath];
}

function assertValidatorOutputHasNoErrors(
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

function parseValidatorOutput(
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
      `IBM OpenAPI Validator returned non-JSON output for ${fixturePath}\nstdout:\n${stdout}`,
      { cause: error }
    );
  }
}

function validatorFindings(output: unknown): readonly ValidatorFinding[] {
  if (Array.isArray(output)) {
    return output.filter(isValidatorFinding);
  }

  if (!isRecord(output)) {
    return [];
  }

  const results = output.results;

  if (Array.isArray(results)) {
    return results.filter(isValidatorFinding);
  }

  const errors = output.errors;

  return Array.isArray(errors) ? errors.filter(isValidatorFinding) : [];
}

function validatorSummaryErrorCount(output: unknown): number | undefined {
  if (!isRecord(output) || !isRecord(output.summary)) {
    return undefined;
  }

  const summary = output.summary as ValidatorSummary;
  const errorCount = numericSummaryValue(summary.errors ?? summary.error);

  return errorCount ?? numericSummaryValue(summary.total);
}

function numericSummaryValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isErrorFinding(finding: ValidatorFinding): boolean {
  return finding.severity === 0 || finding.severity === "error";
}

function isValidatorFinding(value: unknown): value is ValidatorFinding {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validatorFailureMessage(fixturePath: string, stdout: string): string {
  return `IBM OpenAPI Validator reported OpenAPI validity errors for ${fixturePath}\nstdout:\n${stdout}`;
}

function resolveLintOpenApiCliPath(): string | undefined {
  try {
    const packageJsonPath =
      require.resolve("ibm-openapi-validator/package.json");
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf8")
    ) as PackageJsonWithBin;
    const binPath = lintOpenApiBinPath(packageJson);

    return binPath === undefined
      ? undefined
      : resolve(dirname(packageJsonPath), binPath);
  } catch {
    return undefined;
  }
}

function lintOpenApiBinPath(
  packageJson: PackageJsonWithBin
): string | undefined {
  if (typeof packageJson.bin === "string") {
    return packageJson.bin;
  }

  return packageJson.bin?.["lint-openapi"];
}

function commandOutput(error: unknown): {
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

function stringifyExecFileOutput(output: {
  readonly stdout: unknown;
  readonly stderr: unknown;
}): ValidatorCommandOutput {
  return {
    stdout: stringifyCommandOutput(output.stdout),
    stderr: stringifyCommandOutput(output.stderr),
  };
}

function stringifyCommandOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return value === undefined ? "" : String(value);
}
