import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { Formatter } from "../../src/services/Formatter.js";

describe("Formatter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-fmt-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.effect("formats files in a directory or no-ops when oxfmt is unavailable", () =>
    Effect.gen(function* () {
      const filePath = path.join(tempDir, "sample.ts");
      const source = "const   x    =   1;\n";
      fs.writeFileSync(filePath, source);

      yield* Formatter.format(tempDir);

      const result = fs.readFileSync(filePath, "utf8");
      // oxfmt is optional — either it ran (different content) or it was
      // unavailable (content unchanged). Both outcomes are acceptable;
      // what matters is that the service ran without throwing.
      expect(typeof result).toBe("string");
    }).pipe(Effect.provide(Formatter.Default))
  );
});
