import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { Generator } from "../src/generators/generator.js";
import { createLogger } from "../src/logger.js";
import { createTempDirFactory } from "./__helpers__/tempDir.js";

// Temp dirs MUST live inside the CLI package so pnpm-workspace module
// resolution finds `@rexeus/typeweaver-core` when the bundler loads the spec.
// Anchoring to this file's URL keeps tests stable regardless of which
// directory `vitest` is launched from.
const PACKAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

describe("Generator integration", () => {
  const createTempDir = createTempDirFactory(
    ".typeweaver-generator-integration-",
    PACKAGE_DIR
  );

  test("generates namespaced plugin output without leaking bundler plumbing", async () => {
    const tempDir = createTempDir();
    const specDir = path.join(tempDir, "spec");
    const outputDir = path.join(tempDir, "generated");
    const specFile = path.join(specDir, "index.ts");

    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(
      specFile,
      [
        'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
        'import { z } from "zod";',
        "",
        "const todoResponse = defineResponse({",
        '  name: "GetTodoSuccess",',
        "  statusCode: HttpStatusCode.OK,",
        '  description: "Todo loaded",',
        "  body: z.object({ id: z.string() }),",
        "});",
        "",
        "export const spec = defineSpec({",
        "  resources: {",
        "    todo: {",
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

    const generator = new Generator({
      logger: createLogger({ quiet: true }),
    });

    await generator.generate(
      specFile,
      outputDir,
      {
        input: specFile,
        output: outputDir,
        plugins: ["clients", "server", "hono", "aws-cdk"],
        clean: true,
        format: false,
      },
      tempDir
    );

    for (const namespace of [
      "types",
      "clients",
      "server",
      "hono",
      "aws-cdk",
      "spec",
      "responses",
      "lib",
    ]) {
      expect(fs.existsSync(path.join(outputDir, namespace))).toBe(true);
    }

    const requestCommandFile = path.join(
      outputDir,
      "clients",
      "todo",
      "GetTodoRequestCommand.ts"
    );
    const requestCommandContent = fs.readFileSync(requestCommandFile, "utf8");

    expect(requestCommandContent).toContain(
      'from "../../types/todo/getTodoRequest.js"'
    );
    expect(requestCommandContent).toContain(
      'from "../../types/todo/getTodoResponseValidator.js"'
    );
    expect(fs.existsSync(path.join(outputDir, "node_modules"))).toBe(false);
  });
});
