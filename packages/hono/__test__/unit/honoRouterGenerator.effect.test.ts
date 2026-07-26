import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { generate } from "../../src/honoRouterGenerator.js";
import type { HonoGenerationContext } from "../../src/honoRouterGenerator.js";

describe("Hono Effect-native generator reference", () => {
  test("renders and writes a router through the Effect context surface", async () => {
    const normalizedSpec: NormalizedSpec = {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "getTodo",
              method: HttpMethod.GET,
              path: "/todos/:todoId",
              summary: "Get a todo",
              responses: [],
            },
          ],
        },
      ],
      responses: [],
      warnings: [],
    };
    const renders: unknown[] = [];
    const writes: Array<{ readonly path: string; readonly content: string }> =
      [];
    const context: HonoGenerationContext = {
      normalizedSpec,
      outputDir: "/generated",
      getResourceOutputDir: resourceName =>
        path.join("/generated", resourceName),
      renderTemplateEffect: (_templatePath, data) =>
        Effect.sync(() => {
          renders.push(data);
          return "effect-rendered-router";
        }),
      writeFileEffect: (relativePath, content) =>
        Effect.sync(() => {
          writes.push({ path: relativePath, content });
        }),
    };

    await Effect.runPromise(generate(context));

    expect(renders).toHaveLength(1);
    expect(writes).toEqual([
      {
        path: path.join("todo", "TodoHono.ts"),
        content: "effect-rendered-router",
      },
    ]);
  });
});
