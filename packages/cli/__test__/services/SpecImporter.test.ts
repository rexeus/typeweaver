import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { SpecImporter } from "../../src/services/SpecImporter.js";

/**
 * Standalone happy-path test for `SpecImporter.Default`. The default layer
 * runs the real `import(moduleUrl)` seam, so the test writes a tiny .mjs
 * file that exports a `spec` shaped to match `isSpecDefinition`. This
 * exercises the file-read → content-hash → import → guard pipeline that
 * `SpecLoader` orchestrates in production.
 */

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-importer-"));
  tempDirs.push(dir);
  return dir;
};

const writeMinimalSpecModule = (dir: string): string => {
  const filePath = path.join(dir, "spec.mjs");
  fs.writeFileSync(
    filePath,
    [
      "export const spec = {",
      '  metadata: { title: "Items API", version: "1.0.0" },',
      "  resources: {",
      "    item: {",
      "      operations: [",
      "        {",
      '          operationId: "getItem",',
      '          path: "/items/:itemId",',
      '          method: "GET",',
      '          summary: "Get item",',
      "          request: {},",
      "          responses: [",
      "            {",
      '              name: "ItemLoaded",',
      "              statusCode: 200,",
      '              description: "Item loaded",',
      "              body: {},",
      "            },",
      "          ],",
      "        },",
      "      ],",
      "    },",
      "  },",
      "};",
      "",
    ].join("\n")
  );
  return filePath;
};

describe("SpecImporter", () => {
  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("Default layer imports a bundled spec module and returns its SpecDefinition", async () => {
    const dir = createTempDir();
    const bundledSpecFile = writeMinimalSpecModule(dir);

    const layer = Layer.provide(SpecImporter.Default, NodeFileSystem.layer);

    const definition = await Effect.runPromise(
      Effect.gen(function* () {
        const importer = yield* SpecImporter;
        return yield* importer.importDefinition(bundledSpecFile);
      }).pipe(Effect.provide(layer))
    );

    expect(definition).toMatchObject({
      metadata: {
        title: "Items API",
        version: "1.0.0",
      },
      resources: {
        item: {
          operations: expect.any(Array) as unknown[],
        },
      },
    });
  });
});
