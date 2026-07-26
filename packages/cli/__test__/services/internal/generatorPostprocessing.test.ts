import { it } from "@effect/vitest";
import { Effect } from "effect";
import { withCapturedLogs } from "test-utils/src/effect/index.js";
import { describe, expect } from "vitest";
import { Formatter } from "../../../src/services/Formatter.js";
import { runGeneratorPostprocessing } from "../../../src/services/internal/generatorPostprocessing.js";
import type { GenerationPlan } from "../../../src/services/internal/generatorPreflight.js";
import type { GenerationResult } from "../../../src/services/internal/pluginLifecycle.js";

const makePlan = (format: boolean): GenerationPlan => ({
  params: {
    inputFile: "spec/index.ts",
    outputDir: "generated/output",
    config: {
      input: "spec/index.ts",
      output: "generated/output",
      format,
    },
    currentWorkingDirectory: "/workspace",
  },
  cwd: "/workspace",
  inputFile: "/workspace/spec/index.ts",
  inputDir: "/workspace/spec",
  outputDir: "/workspace/generated/output",
  responsesOutputDir: "/workspace/generated/output/responses",
  specOutputDir: "/workspace/generated/output/spec",
  templateDir: "/workspace/templates",
  userConfig: {
    input: "spec/index.ts",
    output: "generated/output",
    format,
  },
});

describe("runGeneratorPostprocessing", () => {
  it.effect("skips formatting when formatting is disabled", () =>
    Effect.gen(function* () {
      const formattedPaths: string[] = [];
      const formatter = Formatter.make({
        format: outputDir =>
          Effect.sync(() => {
            formattedPaths.push(outputDir);
          }),
      });
      const result: GenerationResult = {
        generatedFiles: ["item/GetItem.ts", "index.ts"],
      };

      const captured = yield* withCapturedLogs(
        runGeneratorPostprocessing(makePlan(false), result, formatter)
      );

      expect(formattedPaths).toEqual([]);
      expect(captured.logs.map(log => log.message)).toEqual([
        "Generation complete!",
        "Generated files: 2",
      ]);
    })
  );

  it.effect(
    "formats the output before reporting completion and the final file count",
    () =>
      Effect.gen(function* () {
        const formattedPaths: string[] = [];
        const formatter = Formatter.make({
          format: outputDir =>
            Effect.sync(() => {
              formattedPaths.push(outputDir);
            }).pipe(Effect.zipRight(Effect.logInfo("Formatting finished"))),
        });
        const result: GenerationResult = {
          generatedFiles: ["item/GetItem.ts", "responses/Item.ts", "index.ts"],
        };

        const captured = yield* withCapturedLogs(
          runGeneratorPostprocessing(makePlan(true), result, formatter)
        );

        expect(formattedPaths).toEqual(["/workspace/generated/output"]);
        expect(captured.logs.map(log => log.message)).toEqual([
          "Formatting finished",
          "Generation complete!",
          "Generated files: 3",
        ]);
      })
  );
});
