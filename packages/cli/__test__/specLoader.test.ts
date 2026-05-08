import fs from "node:fs";
import path from "node:path";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test } from "vitest";
import { InvalidSpecEntrypointError } from "../src/generators/spec/InvalidSpecEntrypointError.js";
import { createWrapperImportSpecifier } from "../src/generators/spec/specBundler.js";
import { isSpecDefinition } from "../src/generators/spec/specGuards.js";
import { loadSpec } from "../src/generators/specLoader.js";

const SPEC_DECLARATION = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

type TempProject = {
  readonly projectDir: string;
  readonly outputDir: string;
};

type LoadedSpec = Awaited<ReturnType<typeof loadSpec>>;

type TodoSpecExportStyle = "named" | "default";

describe("SpecLoader", () => {
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

  const expectBundledArtifacts = (outputDir: string): void => {
    expect(fs.readdirSync(outputDir).sort()).toEqual(["spec.d.ts", "spec.js"]);
    expect(fs.readFileSync(path.join(outputDir, "spec.d.ts"), "utf8")).toBe(
      SPEC_DECLARATION
    );
  };

  const expectSingleTodoResource = (loadedSpec: LoadedSpec): void => {
    expect(Object.keys(loadedSpec.definition.resources)).toEqual(["todos"]);
    expect(loadedSpec.definition.resources.todos?.operations).toHaveLength(1);
    expect(loadedSpec.normalizedSpec.resources).toEqual([
      expect.objectContaining({
        name: "todos",
        operations: [
          expect.objectContaining({
            operationId: "getTodo",
            path: "/todos/:todoId",
          }),
        ],
      }),
    ]);
  };

  const writeTodoResponseModule = (
    project: TempProject,
    options: { readonly fileName: string }
  ): string => {
    return writeProjectFile(
      project,
      options.fileName,
      `
        import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
        import { z } from "zod";

        export const todoResponse = defineResponse({
          name: "TodoResponse",
          statusCode: HttpStatusCode.OK,
          description: "Todo loaded",
          body: z.object({ id: z.string() }),
        });
      `
    );
  };

  const writeTodoSpecEntrypoint = (
    project: TempProject,
    options: {
      readonly fileName: string;
      readonly exportStyle: TodoSpecExportStyle;
      readonly responseImport: string;
      readonly includeNotFoundResponse?: boolean;
    }
  ): string => {
    const specExport =
      options.exportStyle === "default"
        ? "export default defineSpec"
        : "export const spec = defineSpec";
    const coreImports = options.includeNotFoundResponse
      ? "defineOperation, defineSpec, HttpMethod, HttpStatusCode"
      : "defineOperation, defineSpec, HttpMethod";
    const operationResponses = options.includeNotFoundResponse
      ? `
                    todoResponse,
                    {
                      name: "TodoNotFound",
                      statusCode: HttpStatusCode.NOT_FOUND,
                      description: "Todo not found",
                      body: z.object({ message: z.string() }),
                    },
                  `
      : "todoResponse";

    return writeSpecEntrypoint(
      project,
      options.fileName,
      `
        import { ${coreImports} } from "@rexeus/typeweaver-core";
        import { z } from "zod";
        import { todoResponse } from ${JSON.stringify(options.responseImport)};

        ${specExport}({
          resources: {
            todos: {
              operations: [
                defineOperation({
                  operationId: "getTodo",
                  method: HttpMethod.GET,
                  path: "/todos/:todoId",
                  summary: "Get todo",
                  request: {
                    param: z.object({ todoId: z.string() }),
                  },
                  responses: [${operationResponses}],
                }),
              ],
            },
          },
        });
      `
    );
  };

  const writeTodoResourcesEntrypoint = (
    project: TempProject,
    options: { readonly fileName: string }
  ): string => {
    return writeSpecEntrypoint(
      project,
      options.fileName,
      `
        import { defineOperation, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
        import { z } from "zod";

        export const resources = {
          todos: {
            operations: [
              defineOperation({
                operationId: "getTodo",
                method: HttpMethod.GET,
                path: "/todos/:todoId",
                summary: "Get todo",
                request: {
                  param: z.object({ todoId: z.string() }),
                },
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: HttpStatusCode.OK,
                    description: "Todo loaded",
                    body: z.object({ id: z.string() }),
                  },
                ],
              }),
            ],
          },
        };
      `
    );
  };

  const writeTodoSpecWithOperation = (
    project: TempProject,
    options: {
      readonly fileName: string;
      readonly operationId: string;
      readonly summary: string;
    }
  ): string => {
    return writeSpecEntrypoint(
      project,
      options.fileName,
      `
        export const spec = {
          resources: {
            todos: {
              operations: [
                {
                  operationId: ${JSON.stringify(options.operationId)},
                  method: "GET",
                  path: "/todos",
                  summary: ${JSON.stringify(options.summary)},
                  request: {},
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
  };

  const validSpecDefinition = {
    resources: {
      todos: {
        operations: [
          {
            operationId: "listTodos",
            method: "GET",
            path: "/todos",
            summary: "List todos",
            request: {},
            responses: [
              {
                name: "TodoResponse",
                statusCode: HttpStatusCode.OK,
                description: "Todo response",
              },
            ],
          },
        ],
      },
    },
  };

  test("accepts a structurally valid spec definition", () => {
    expect(isSpecDefinition(validSpecDefinition)).toBe(true);
  });

  test.each([
    { scenario: "null spec", value: null },
    { scenario: "non-object spec", value: "not a spec" },
    { scenario: "non-object resources", value: { resources: [1, 2] } },
    {
      scenario: "resource without operations array",
      value: { resources: { todos: {} } },
    },
    {
      scenario: "operation missing summary",
      value: {
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                request: {},
                responses:
                  validSpecDefinition.resources.todos.operations[0].responses,
              },
            ],
          },
        },
      },
    },
    {
      scenario: "operation with undefined request",
      value: {
        resources: {
          todos: {
            operations: [
              {
                ...validSpecDefinition.resources.todos.operations[0],
                request: undefined,
              },
            ],
          },
        },
      },
    },
    {
      scenario: "invalid HTTP method",
      value: {
        resources: {
          todos: {
            operations: [
              {
                ...validSpecDefinition.resources.todos.operations[0],
                method: "FETCH",
              },
            ],
          },
        },
      },
    },
    {
      scenario: "empty responses array",
      value: {
        resources: {
          todos: {
            operations: [
              {
                ...validSpecDefinition.resources.todos.operations[0],
                responses: [],
              },
            ],
          },
        },
      },
    },
    {
      scenario: "response missing status code",
      value: {
        resources: {
          todos: {
            operations: [
              {
                ...validSpecDefinition.resources.todos.operations[0],
                responses: [
                  {
                    name: "TodoResponse",
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      },
    },
    {
      scenario: "response with unregistered status code",
      value: {
        resources: {
          todos: {
            operations: [
              {
                ...validSpecDefinition.resources.todos.operations[0],
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: 299,
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      },
    },
  ])("rejects $scenario", ({ value }) => {
    expect(isSpecDefinition(value)).toBe(false);
  });

  test("creates a relative wrapper import specifier for posix paths", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec-entrypoint.ts",
        "/tmp/typeweaver/spec.ts"
      )
    ).toBe("./spec.ts");
  });

  test("creates a relative wrapper import specifier for windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "C:\\project\\.typeweaver\\spec-entrypoint.ts",
        "C:\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });

  test("creates a relative wrapper import specifier for UNC windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "\\\\server\\share\\project\\.typeweaver\\spec-entrypoint.ts",
        "\\\\server\\share\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });

  test("preserves spaces in wrapper import specifiers", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec loader/spec-entrypoint.ts",
        "/tmp/typeweaver/spec source/spec.ts"
      )
    ).toBe("../spec source/spec.ts");
  });

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
      }),
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
        }),
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
      }),
    ]);
    expectBundledArtifacts(project.outputDir);
  });

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
        }),
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
  });

  test("propagates errors thrown while importing bundled specs", async () => {
    const project = createTempProject();
    const specFile = writeSpecEntrypoint(
      project,
      "spec.ts",
      `
        export const spec = (() => {
          throw new Error("Spec evaluation failed");
        })();
      `
    );

    await expect(loadProjectSpec(project, specFile)).rejects.toThrow(
      "Spec evaluation failed"
    );
  });

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
