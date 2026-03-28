import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { isSpecDefinition } from "../src/generators/spec/specGuards.js";
import { SpecLoader } from "../src/generators/SpecLoader.js";

describe("SpecLoader", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.forEach(tempDir => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
    tempDirs.length = 0;
  });

  const createTempDir = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(process.cwd(), ".typeweaver-spec-loader-test-")
    );
    tempDirs.push(tempDir);

    return tempDir;
  };

  test("accepts a structurally valid spec definition", () => {
    expect(
      isSpecDefinition({
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
                    statusCode: 200,
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(true);
  });

  test("rejects resources without an operations array", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {},
        },
      })
    ).toBe(false);
  });

  test("rejects operations missing required fields", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                request: {},
                responses: [],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects operations with invalid http methods", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "FETCH",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects responses missing required fields", () => {
    expect(
      isSpecDefinition({
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
                    description: "Todo response",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects null input", () => {
    expect(isSpecDefinition(null)).toBe(false);
  });

  test("rejects undefined input", () => {
    expect(isSpecDefinition(undefined)).toBe(false);
  });

  test("rejects non-object resources", () => {
    expect(isSpecDefinition({ resources: [1, 2] })).toBe(false);
  });

  test("rejects operations with empty responses array", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: {},
                responses: [],
              },
            ],
          },
        },
      })
    ).toBe(false);
  });

  test("rejects operations with undefined request", () => {
    expect(
      isSpecDefinition({
        resources: {
          todos: {
            operations: [
              {
                operationId: "listTodos",
                method: "GET",
                path: "/todos",
                summary: "List todos",
                request: undefined,
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
      })
    ).toBe(false);
  });

  test("loads bundled specs and emits only the bundled spec artifacts", async () => {
    const fixtureDir = createTempDir();
    const outputDir = path.join(fixtureDir, "generated-spec");
    const helperFile = path.join(fixtureDir, "responses.ts");
    const specFile = path.join(fixtureDir, "spec.ts");

    fs.writeFileSync(
      helperFile,
      [
        'import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";',
        'import { z } from "zod";',
        "",
        "export const todoResponse = defineResponse({",
        '  name: "TodoResponse",',
        "  statusCode: HttpStatusCode.OK,",
        '  description: "Todo loaded",',
        "  body: z.object({ id: z.string() }),",
        "});",
        "",
      ].join("\n")
    );

    fs.writeFileSync(
      specFile,
      [
        'import { defineOperation, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
        'import { z } from "zod";',
        'import { todoResponse } from "./responses";',
        "",
        "export default defineSpec({",
        "  resources: {",
        "    todos: {",
        "      operations: [",
        "        defineOperation({",
        '          operationId: "getTodo",',
        "          method: HttpMethod.GET,",
        '          path: "/todos/:todoId",',
        '          summary: "Get todo",',
        "          request: {",
        "            param: z.object({ todoId: z.string() }),",
        "          },",
        "          responses: [",
        "            todoResponse,",
        "            {",
        '              name: "TodoNotFound",',
        "              statusCode: HttpStatusCode.NOT_FOUND,",
        '              description: "Todo not found",',
        "              body: z.object({ message: z.string() }),",
        "            },",
        "          ],",
        "        }),",
        "      ],",
        "    },",
        "  },",
        "});",
        "",
      ].join("\n")
    );

    const loadedSpec = await new SpecLoader().load({
      inputFile: specFile,
      specOutputDir: outputDir,
    });

    expect(loadedSpec.definition.resources.todos?.operations).toHaveLength(1);
    expect(loadedSpec.normalizedSpec.responses).toEqual([
      expect.objectContaining({
        name: "TodoResponse",
        kind: "response",
        statusCode: 200,
      }),
    ]);
    expect(loadedSpec.normalizedSpec.resources).toEqual([
      {
        name: "todos",
        operations: [
          {
            operationId: "getTodo",
            method: "GET",
            path: "/todos/:todoId",
            summary: "Get todo",
            request: {
              param: expect.any(Object),
            },
            responses: [
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
            ],
          },
        ],
      },
    ]);

    expect(fs.existsSync(path.join(outputDir, "spec.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "spec.d.ts"))).toBe(true);

    expect(fs.existsSync(path.join(outputDir, "todos"))).toBe(false);
  });
});
