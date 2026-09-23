import { afterEach, describe, expect, test } from "vitest";
import {
  expectBundledArtifacts,
  expectSingleTodoResource,
} from "./assertions.js";
import {
  cleanupSpecLoaderProjects,
  createTempProject,
  loadProjectSpec,
  writeTodoResourcesEntrypoint,
  writeTodoSpecWithOperation,
} from "./fixtures.js";

afterEach(() => {
  cleanupSpecLoaderProjects();
});

describe("SpecLoader supported spec module reuse", () => {
  test("loads module namespace specs exported as resources", async () => {
    const project = createTempProject();
    const specFile = writeTodoResourcesEntrypoint(project, {
      fileName: "spec.ts",
    });

    const loadedSpec = await loadProjectSpec(project, specFile);

    expectSingleTodoResource(loadedSpec);
    expect(
      loadedSpec.normalizedSpec.resources[0]?.operations[0]?.responses
    ).toEqual([
      {
        responseName: "TodoResponse",
        source: "inline",
        response: expect.objectContaining({
          name: "TodoResponse",
          statusCode: 200,
        }) as unknown,
      },
    ]);
    expectBundledArtifacts(project.outputDir);
  });

  test("loads rewritten specs from the same output file", async () => {
    const project = createTempProject();
    const specFile = writeTodoSpecWithOperation(project, {
      fileName: "spec.ts",
      operationId: "getFirstTodo",
      summary: "Get first todo",
    });

    const firstSpec = await loadProjectSpec(project, specFile);

    expect(
      firstSpec.normalizedSpec.resources[0]?.operations[0]?.operationId
    ).toBe("getFirstTodo");

    writeTodoSpecWithOperation(project, {
      fileName: "spec.ts",
      operationId: "getSecondTodo",
      summary: "Get second todo",
    });

    const secondSpec = await loadProjectSpec(project, specFile);

    expect(
      secondSpec.normalizedSpec.resources[0]?.operations[0]?.operationId
    ).toBe("getSecondTodo");
    expectBundledArtifacts(project.outputDir);
  });
});
