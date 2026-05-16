import {
  GeneratedFiles,
  PathSafety,
  TemplateRenderer,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { ConfigLoader } from "../../src/services/ConfigLoader.js";
import { Formatter } from "../../src/services/Formatter.js";
import { SpecLoader } from "../../src/services/SpecLoader.js";

describe("ProductionLayer", () => {
  // Smoke test: every service registered on the production layer must be
  // resolvable. Catches dependency-graph regressions where a new service
  // is added but its layer is not stitched into ProductionLayer.
  test("resolves every registered service tag", async () => {
    // SpecBundler / SpecImporter are scoped *inside* SpecLoader via its
    // `dependencies`, so they are intentionally not resolvable at the top.
    const program = Effect.gen(function* () {
      yield* ConfigLoader;
      yield* Formatter;
      yield* SpecLoader;
      yield* GeneratedFiles;
      yield* PathSafety;
      yield* TemplateRenderer;
      return "all-resolved" as const;
    });

    const result = await effectRuntime.runPromise(program);
    expect(result).toBe("all-resolved");
  });
});
