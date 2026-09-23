import { afterEach, describe, expect, test } from "vitest";
import {
  expectBundledArtifacts,
  expectSingleTodoResource,
} from "./assertions.js";
import {
  cleanupSpecLoaderProjects,
  createTempProject,
  loadProjectSpec,
  writeTodoResponseModule,
  writeTodoSpecEntrypoint,
} from "./fixtures.js";

afterEach(() => {
  cleanupSpecLoaderProjects();
});

describe("SpecLoader supported spec module exports", () => {
  test("loads TypeScript specs with extensionless relative imports", async () => {
    const project = createTempProject();

    writeTodoResponseModule(project, { fileName: "responses.ts" });
    const specFile = writeTodoSpecEntrypoint(project, {
      fileName: "spec.ts",
      exportStyle: "named",
      responseImport: "./responses",
      includeNotFoundResponse: true,
    });

    const loadedSpec = await loadProjectSpec(project, specFile);

    expectSingleTodoResource(loadedSpec);
    expect(loadedSpec.normalizedSpec.responses).toEqual([
      expect.objectContaining({
        name: "TodoResponse",
        kind: "response",
        statusCode: 200,
      }) as unknown,
    ]);
    expect(
      loadedSpec.normalizedSpec.resources[0]?.operations[0]?.responses
    ).toEqual([
      {
        responseName: "TodoResponse",
        source: "canonical",
      },
      {
        responseName: "TodoNotFound",
        source: "inline",
        response: expect.objectContaining({
          name: "TodoNotFound",
          statusCode: 404,
        }) as unknown,
      },
    ]);
    expectBundledArtifacts(project.outputDir);
  });

  test("loads JavaScript specs exported as default", async () => {
    const project = createTempProject();

    writeTodoResponseModule(project, { fileName: "responses.js" });
    const specFile = writeTodoSpecEntrypoint(project, {
      fileName: "spec.js",
      exportStyle: "default",
      responseImport: "./responses.js",
    });

    const loadedSpec = await loadProjectSpec(project, specFile);

    expectSingleTodoResource(loadedSpec);
    expect(loadedSpec.normalizedSpec.responses).toEqual([
      expect.objectContaining({
        name: "TodoResponse",
        kind: "response",
        statusCode: 200,
      }) as unknown,
    ]);
    expectBundledArtifacts(project.outputDir);
  });
});
