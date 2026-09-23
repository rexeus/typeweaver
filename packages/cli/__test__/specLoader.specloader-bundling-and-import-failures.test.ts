import fs from "node:fs";
import path from "node:path";
import { layer as nodeFileSystemLayer } from "@effect/platform-node-shared/NodeFileSystem";
import { Effect, Result, Layer } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import {
  InvalidSpecEntrypointError,
  SpecBundleError,
} from "../src/services/errors/specErrors.js";
import { SpecLoader } from "../src/services/SpecLoader.js";
import type {
  LoadedSpec,
  SpecLoaderConfig,
} from "../src/services/SpecLoader.js";

const SpecLoaderLayer = SpecLoader.Default.pipe(
  Layer.provide(nodeFileSystemLayer)
);

const loadSpec = async (config: SpecLoaderConfig): Promise<LoadedSpec> => {
  const result = await Effect.runPromise(
    Effect.result(SpecLoader.load(config)).pipe(Effect.provide(SpecLoaderLayer))
  );
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

type TempProject = {
  readonly projectDir: string;
  readonly outputDir: string;
};

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

const createTempProject = (): TempProject => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-spec-loader-")
  );
  const projectDir = path.join(tempDir, "project with spaces");

  fs.mkdirSync(projectDir, { recursive: true });
  tempDirs.push(tempDir);

  return {
    projectDir,
    outputDir: path.join(projectDir, "generated spec"),
  };
};

const writeProjectFile = (
  project: TempProject,
  relativePath: string,
  contents: string
): string => {
  const filePath = path.join(project.projectDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trim()}\n`);

  return filePath;
};

const writeSpecEntrypoint = (
  project: TempProject,
  relativePath: string,
  contents: string
): string => {
  return writeProjectFile(project, relativePath, contents);
};

const loadProjectSpec = async (
  project: TempProject,
  inputFile: string
): Promise<LoadedSpec> => {
  return loadSpec({
    inputFile: path.relative(process.cwd(), inputFile),
    specOutputDir: project.outputDir,
  });
};

const createThrowingModuleSource = (options: {
  readonly errorName: string;
  readonly message: string;
}): string => `
    export const spec = (() => {
      class ${options.errorName} extends Error {
        name = "${options.errorName}";
      }

      throw new ${options.errorName}(${JSON.stringify(options.message)});
    })();
  `;

describe("SpecLoader bundling and import failures", () => {
  test("rejects specs with missing imported helpers during bundling", async () => {
    const project = createTempProject();
    const specFile = writeSpecEntrypoint(
      project,
      "spec.ts",
      `
        import { missingResponse } from "./missingHelper";

        export const spec = {
          resources: {
            todos: {
              operations: [
                {
                  operationId: "getTodo",
                  method: "GET",
                  path: "/todos/:todoId",
                  summary: "Get todo",
                  request: {},
                  responses: [missingResponse],
                },
              ],
            },
          },
        };
      `
    );

    await expect(loadProjectSpec(project, specFile)).rejects.toThrow(
      /missingHelper/
    );
    await expect(loadProjectSpec(project, specFile)).rejects.toBeInstanceOf(
      SpecBundleError
    );
    // Discriminating field assertion: the error must carry a non-empty
    // inputFile reference so operators (and the structured logs) can
    // identify which spec entrypoint failed to bundle. The bundler stores
    // the path relative to the cwd it was invoked with, so this asserts
    // the path ends with the spec's basename rather than full equality.
    const error = (await loadProjectSpec(project, specFile).catch(
      (e: unknown) => e
    )) as { readonly inputFile: string };
    expect(error.inputFile).toMatch(/spec\.ts$/);
  });
  test("propagates errors thrown while importing bundled specs", async () => {
    const project = createTempProject();
    const specFile = writeSpecEntrypoint(
      project,
      "spec.ts",
      createThrowingModuleSource({
        errorName: "SpecEvaluationError",
        message: "Spec evaluation failed",
      })
    );

    await expect(loadProjectSpec(project, specFile)).rejects.toThrow(
      "Spec evaluation failed"
    );
  });
});

describe("SpecLoader invalid entrypoints", () => {
  test("rejects entrypoints whose exported spec is not a valid spec definition", async () => {
    const project = createTempProject();
    const specFile = writeSpecEntrypoint(
      project,
      "spec.ts",
      `
        export const spec = {
          resources: [],
        };
      `
    );
    const loadingSpec = loadProjectSpec(project, specFile);

    await expect(loadingSpec).rejects.toThrow(InvalidSpecEntrypointError);
    await expect(loadingSpec).rejects.toThrow(/must export a SpecDefinition/);
  });
  test("rejects entrypoints whose operation omits a request definition", async () => {
    const project = createTempProject();
    const specFile = writeSpecEntrypoint(
      project,
      "spec.ts",
      `
        export const spec = {
          resources: {
            todos: {
              operations: [
                {
                  operationId: "getTodo",
                  method: "GET",
                  path: "/todos/:todoId",
                  summary: "Get todo",
                  responses: [
                    {
                      name: "TodoResponse",
                      statusCode: 200,
                      description: "Todo response",
                    },
                  ],
                },
              ],
            },
          },
        };
      `
    );
    const loadingSpec = loadProjectSpec(project, specFile);

    await expect(loadingSpec).rejects.toThrow(InvalidSpecEntrypointError);
    await expect(loadingSpec).rejects.toThrow(/must export a SpecDefinition/);
  });
});
