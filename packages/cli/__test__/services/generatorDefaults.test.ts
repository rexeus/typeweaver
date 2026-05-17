import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { makeInMemoryFileSystem } from "test-utils";
import { describe, expect, test } from "vitest";
import { resolveTemplateDir } from "../../src/services/generatorDefaults.js";

/**
 * `resolveTemplateDir` probes a fixed list of candidate directories for an
 * `Index.ejs` marker and returns the first match. The candidate list is
 * derived from `import.meta.url` of the production source, so the candidates
 * align with where the build copies templates (`dist/generators/templates/`)
 * and where tsx runs them (`src/generators/templates/`).
 */
const moduleDir = path.dirname(
  fileURLToPath(
    new URL("../../src/services/generatorDefaults.ts", import.meta.url)
  )
);

const TEMPLATE_DIR_CANDIDATES = [
  path.join(moduleDir, "..", "generators", "templates"),
  path.join(moduleDir, "generators", "templates"),
  path.join(moduleDir, "templates"),
  path.join(moduleDir, "..", "templates"),
  path.join(moduleDir, "..", "..", "src", "generators", "templates"),
] as const;

describe("resolveTemplateDir", () => {
  test("returns the first candidate whose Index.ejs exists in the FileSystem", async () => {
    const { layer } = makeInMemoryFileSystem();
    // Seed Index.ejs in the third candidate so the probe walks past the
    // first two before matching.
    const targetCandidate = TEMPLATE_DIR_CANDIDATES[2];

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.writeFileString(
          path.join(targetCandidate, "Index.ejs"),
          "marker"
        );
        return yield* resolveTemplateDir();
      }).pipe(Effect.provide(layer))
    );

    expect(result).toBe(targetCandidate);
  });

  test("falls back to the first candidate when no Index.ejs is present", async () => {
    const { layer } = makeInMemoryFileSystem();

    const result = await Effect.runPromise(
      resolveTemplateDir().pipe(Effect.provide(layer))
    );

    expect(result).toBe(TEMPLATE_DIR_CANDIDATES[0]);
  });
});
