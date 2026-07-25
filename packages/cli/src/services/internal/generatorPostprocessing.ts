import { Effect } from "effect";
import type { Formatter } from "../Formatter.js";
import type { GenerationPlan } from "./generatorPreflight.js";
import type { GenerationResult } from "./pluginLifecycle.js";

export const runGeneratorPostprocessing = (
  plan: GenerationPlan,
  result: GenerationResult,
  formatter: Formatter
) =>
  Effect.gen(function* () {
    if (plan.params.config?.format !== false) {
      yield* formatter.format(plan.outputDir);
    }

    yield* Effect.logInfo("Generation complete!");
    yield* Effect.logInfo(`Generated files: ${result.generatedFiles.length}`);
  });
