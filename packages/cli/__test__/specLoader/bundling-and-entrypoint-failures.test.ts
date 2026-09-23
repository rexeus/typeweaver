import { afterEach, describe, expect, test } from "vitest";
import {
  InvalidSpecEntrypointError,
  SpecBundleError,
} from "../../src/services/errors/specErrors.js";
import {
  cleanupSpecLoaderProjects,
  createTempProject,
  loadProjectSpec,
  writeSpecEntrypoint,
} from "./fixtures.js";

afterEach(cleanupSpecLoaderProjects);

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
