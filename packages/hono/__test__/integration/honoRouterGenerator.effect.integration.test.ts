import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { ContextBuilder } from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { Effect, Layer } from "effect";
import { makeInMemoryFileSystem } from "test-utils/src/effect/index.js";
import { describe, expect, test } from "vitest";
import { generate } from "../../src/honoRouterGenerator.js";

const normalizedSpec: NormalizedSpec = {
  metadata: { title: "Todo API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [
    {
      name: "todo",
      tags: [],
      security: { requirements: [], source: "none" },
      operations: [
        {
          operationId: "getTodo",
          method: HttpMethod.GET,
          path: "/todos/:todoId",
          summary: "Get a todo",
          deprecated: false,
          tags: [],
          security: { requirements: [], source: "none" },
          responses: [],
        },
      ],
    },
  ],
  responses: [],
  warnings: [],
};

const templateFile = fileURLToPath(
  new URL("../../src/templates/HonoRouter.ejs", import.meta.url)
);
const outputFile = "/project/generated/todo/TodoHono.ts";
const renderedRouter = 'export const generatedRouter = "Todo";\n';

const { layer: fileSystemLayer, state } = makeInMemoryFileSystem();
const integrationLayer = Layer.provide(ContextBuilder.Default, fileSystemLayer);

describe("Hono Effect-native generator integration", () => {
  test("renders and writes through the real context while tracking the generated path", async () => {
    state.reset();
    await Effect.runPromise(
      Effect.gen(function* () {
        const contextBuilder = yield* ContextBuilder;
        const templateSeeder = yield* contextBuilder.buildGeneratorContext({
          outputDir: path.dirname(templateFile),
          inputDir: "/project/spec",
          config: {},
          normalizedSpec: {
            metadata: { title: "Empty API", version: "1.0.0" },
            securitySchemes: [],
            security: { requirements: [], source: "none" },
            resources: [],
            responses: [],
            warnings: [],
          },
          templateDir: path.dirname(templateFile),
          coreDir: "@rexeus/typeweaver-core",
          responsesOutputDir: "/project/generated/responses",
          specOutputDir: "/project/generated/spec",
        });
        yield* templateSeeder.context.writeFileEffect(
          path.basename(templateFile),
          'export const generatedRouter = "<%= pascalCaseEntityName %>";\n'
        );

        const built = yield* contextBuilder.buildGeneratorContext({
          outputDir: "/project/generated",
          inputDir: "/project/spec",
          config: {},
          normalizedSpec,
          templateDir: "/project/templates",
          coreDir: "@rexeus/typeweaver-core",
          responsesOutputDir: "/project/generated/responses",
          specOutputDir: "/project/generated/spec",
        });

        yield* generate(built.context);

        expect(state.readFile(outputFile)).toBe(renderedRouter);
        expect(built.context.getGeneratedFiles()).toEqual(["todo/TodoHono.ts"]);
        expect(built.drainPendingWriteLogs()).toEqual(["todo/TodoHono.ts"]);
        expect(
          state
            .listDirectories()
            .filter(directory => directory.includes(".typeweaver-"))
        ).toEqual([]);
      }).pipe(Effect.provide(integrationLayer))
    );
  });
});
