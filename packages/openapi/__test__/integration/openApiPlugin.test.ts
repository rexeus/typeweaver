import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPluginContextBuilder,
  normalizeSpec,
} from "@rexeus/typeweaver-gen";
import { spec } from "test-utils/src/test-project/spec/index.js";
import { afterEach, describe, expect, test } from "vitest";
import { OpenApiPlugin } from "../../src/index.js";

type OpenApiDocument = {
  readonly openapi: string;
  readonly info: {
    readonly title: string;
    readonly version: string;
  };
  readonly servers?: readonly { readonly url: string }[];
  readonly paths: Record<string, Record<string, unknown>>;
  readonly components: {
    readonly schemas: Record<string, unknown>;
    readonly responses: Record<string, unknown>;
  };
};

type OpenApiValidatorResult = {
  readonly error: {
    readonly results: readonly {
      readonly message: string;
      readonly path: readonly (number | string)[];
      readonly rule: string;
      readonly line: number;
    }[];
    readonly summary: {
      readonly total: number;
    };
  };
  readonly warning: {
    readonly summary: {
      readonly total: number;
    };
  };
};

type OpenApiValidatorInvocation = {
  readonly exitCode: number;
  readonly results: OpenApiValidatorResult;
};

const require = createRequire(import.meta.url);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const checkedInArtifactPath = path.resolve(
  packageRoot,
  "../test-utils/src/test-project/output/openapi/openapi.json"
);

function loadOpenApiDocument(filePath: string): OpenApiDocument {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as OpenApiDocument;
}

function validateOpenApiDocument(filePath: string): OpenApiValidatorInvocation {
  const validatorEntrypoint =
    require.resolve("ibm-openapi-validator/src/cli-validator/index.js");
  const rulesetDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-openapi-validator-")
  );
  const rulesetPath = path.join(rulesetDirectory, "ruleset.yaml");
  fs.writeFileSync(rulesetPath, "extends: spectral:oas\n");

  const validatorProcess = spawnSync(
    process.execPath,
    [validatorEntrypoint, "--json", "--ruleset", rulesetPath, filePath],
    {
      cwd: packageRoot,
      encoding: "utf8",
    }
  );

  fs.rmSync(rulesetDirectory, { recursive: true, force: true });

  if (validatorProcess.error !== undefined) {
    throw validatorProcess.error;
  }

  if (validatorProcess.status === null || validatorProcess.status >= 2) {
    throw new Error(
      [
        "IBM OpenAPI Validator did not complete successfully.",
        validatorProcess.stderr.trim(),
        validatorProcess.stdout.trim(),
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return {
    exitCode: validatorProcess.status,
    results: JSON.parse(validatorProcess.stdout) as OpenApiValidatorResult,
  };
}

function expectValidComponentRefs(document: OpenApiDocument): void {
  const missingRefs: string[] = [];

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        walk(entry);
      }

      return;
    }

    if (value === null || typeof value !== "object") {
      return;
    }

    const maybeRef = (value as { readonly $ref?: unknown }).$ref;
    if (typeof maybeRef === "string" && maybeRef.startsWith("#/components/")) {
      const [componentScope, componentName] = maybeRef
        .replace("#/components/", "")
        .split("/");
      if (componentScope === undefined || componentName === undefined) {
        missingRefs.push(maybeRef);
      } else {
        const componentCollection =
          document.components[
            componentScope as keyof OpenApiDocument["components"]
          ];

        if (componentCollection?.[componentName] === undefined) {
          missingRefs.push(maybeRef);
        }
      }
    }

    for (const child of Object.values(value)) {
      walk(child);
    }
  };

  walk(document);

  expect(missingRefs).toEqual([]);
}

function expectGeneratedArtifact(document: OpenApiDocument): void {
  expect(document).toMatchObject({
    openapi: "3.1.1",
    info: {
      title: "Test Utils API",
      version: "0.10.1",
    },
    servers: [{ url: "https://example.test" }],
  });
}

function expectTodosPathContract(document: OpenApiDocument): void {
  expect(document.paths["/todos/{todoId}"]).toMatchObject({
    get: {
      operationId: expect.any(String),
      summary: expect.any(String),
      responses: {
        "200": {
          $ref: "#/components/responses/GetTodoSuccess",
        },
        "404": {
          $ref: "#/components/responses/TodoNotFoundError",
        },
      },
    },
    delete: {
      responses: {
        "204": {
          $ref: "#/components/responses/DeleteTodoSuccess",
        },
      },
    },
  });

  expect(document.components.responses.GetTodoSuccess).toMatchObject({
    description: "Todo retrieved successfully",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/GetTodoSuccessBody",
        },
      },
    },
  });

  expect(document.components.schemas.GetTodoSuccessBody).toMatchObject({
    type: "object",
    properties: {
      id: {
        type: "string",
        format: "ulid",
      },
      status: {
        type: "string",
        enum: ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
      },
      priority: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH"],
      },
    },
    required: [
      "id",
      "accountId",
      "title",
      "status",
      "createdAt",
      "modifiedAt",
      "createdBy",
      "modifiedBy",
    ],
    additionalProperties: false,
  });
}

function expectDocumentContracts(document: OpenApiDocument): void {
  expectTodosPathContract(document);
  expectValidComponentRefs(document);
}

function createGeneratedArtifact(tempDirectories: string[]): {
  readonly artifactPath: string;
  readonly outputDir: string;
} {
  const outputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-openapi-")
  );
  tempDirectories.push(outputDir);

  const contextBuilder = createPluginContextBuilder();
  const normalizedSpec = normalizeSpec(spec);
  const plugin = new OpenApiPlugin({
    info: {
      title: "Test Utils API",
      version: "0.10.1",
    },
    servers: [{ url: "https://example.test" }],
  });

  const context = contextBuilder.createGeneratorContext({
    pluginName: "openapi",
    outputDir,
    inputDir: path.join(outputDir, "input"),
    config: {
      info: {
        title: "Test Utils API",
        version: "0.10.1",
      },
      servers: [{ url: "https://example.test" }],
    },
    normalizedSpec,
    templateDir: outputDir,
    coreDir: "@rexeus/typeweaver-core",
    responsesOutputDir: path.join(outputDir, "responses"),
    specOutputDir: path.join(outputDir, "spec"),
  });

  plugin.generate(context);

  return {
    artifactPath: path.join(outputDir, "openapi", "openapi.json"),
    outputDir,
  };
}

describe("OpenApiPlugin", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    for (const directory of tempDirectories) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("writes a useful OpenAPI artifact for a real normalized spec", () => {
    const { artifactPath } = createGeneratedArtifact(tempDirectories);
    const document = loadOpenApiDocument(artifactPath);

    expectGeneratedArtifact(document);
    expectDocumentContracts(document);
    expect(Object.keys(document.components.schemas).length).toBeGreaterThan(0);
    expect(Object.keys(document.components.responses).length).toBeGreaterThan(
      0
    );
  });

  test("ships the test-utils project with a generated OpenAPI artifact", () => {
    const document = loadOpenApiDocument(checkedInArtifactPath);

    expect(document.openapi).toBe("3.1.1");
    expect(Object.keys(document.paths).length).toBeGreaterThan(0);

    expectDocumentContracts(document);
  });

  test("validates the checked-in OpenAPI artifact with IBM OpenAPI Validator", () => {
    const validation = validateOpenApiDocument(checkedInArtifactPath);

    expect(validation.exitCode).toBeLessThan(2);
    expect(validation.results.error.results).toEqual([]);
    expect(validation.results.error.summary.total).toBe(0);
  });
});
