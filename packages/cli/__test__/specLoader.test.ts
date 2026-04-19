import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { loadSpec } from "../src/generators/specLoader.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";

// Integration coverage for the full spec-loading pipeline. The pure-function
// guards around it are unit-tested in specGuards.test.ts and specBundler.test.ts.
//
// Temp dirs MUST live inside the CLI package so pnpm-workspace module
// resolution finds `@rexeus/typeweaver-core` when the bundler loads the spec.
// Anchoring to this file's URL keeps tests stable regardless of which
// directory `vitest` is launched from.
const PACKAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

describe("loadSpec (integration)", () => {
  const createTempDir = createTempDirFactory(
    ".typeweaver-spec-loader-test-",
    PACKAGE_DIR
  );

  test("normalizes bundled TypeScript specs and emits only spec artifacts", async () => {
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
        "export const spec = defineSpec({",
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

    const loadedSpec = await loadSpec({
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
    expect(fs.existsSync(path.join(fixtureDir, "node_modules"))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "todos"))).toBe(false);
  });

  test("normalizes bundled JavaScript specs", async () => {
    const fixtureDir = createTempDir();
    const outputDir = path.join(fixtureDir, "generated-spec");
    const helperFile = path.join(fixtureDir, "responses.js");
    const specFile = path.join(fixtureDir, "spec.js");

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
        'import { defineOperation, defineSpec, HttpMethod } from "@rexeus/typeweaver-core";',
        'import { z } from "zod";',
        'import { todoResponse } from "./responses.js";',
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
        "          responses: [todoResponse],",
        "        }),",
        "      ],",
        "    },",
        "  },",
        "});",
        "",
      ].join("\n")
    );

    const loadedSpec = await loadSpec({
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

    expect(fs.existsSync(path.join(outputDir, "spec.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "spec.d.ts"))).toBe(true);
  });
});
