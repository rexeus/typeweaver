import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceReader } from "../src/generators/ResourceReader.js";

describe("ResourceReader", () => {
  describe("getResources – empty entity handling", () => {
    let tmpDir: string;
    let tmpOutputDir: string;
    let tmpSharedDir: string;
    let tmpSharedOutputDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-src-"));
      tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-out-"));
      tmpSharedDir = path.join(tmpDir, "shared");
      tmpSharedOutputDir = path.join(tmpOutputDir, "shared");

      vi.spyOn(console, "info").mockImplementation(() => {});
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(tmpOutputDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    const createReader = (sourceDir: string) =>
      new ResourceReader({
        sourceDir,
        outputDir: tmpOutputDir,
        sharedSourceDir: tmpSharedDir,
        sharedOutputDir: tmpSharedOutputDir,
      });

    test("skips empty entity directory", async () => {
      fs.mkdirSync(path.join(tmpDir, "empty-entity"));

      const reader = createReader(tmpDir);
      const result = await reader.getResources();

      expect(result.entityResources).not.toHaveProperty("empty-entity");
      expect(console.info).toHaveBeenCalledWith(
        "Skipping 'empty-entity' as it contains no valid definitions"
      );
    });

    test("skips entity directory containing no .ts files", async () => {
      const entityDir = path.join(tmpDir, "no-ts-files");
      fs.mkdirSync(entityDir);
      fs.writeFileSync(path.join(entityDir, "readme.md"), "# Not a definition");
      fs.writeFileSync(path.join(entityDir, "data.json"), "{}");

      const reader = createReader(tmpDir);
      const result = await reader.getResources();

      expect(result.entityResources).not.toHaveProperty("no-ts-files");
    });

    test("skips entity directory with only non-definition .ts files", async () => {
      const entityDir = path.join(tmpDir, "helpers-only");
      fs.mkdirSync(entityDir);
      fs.writeFileSync(
        path.join(entityDir, "helperSchema.ts"),
        "export default { foo: 'bar' };\n"
      );

      const reader = createReader(tmpDir);
      const result = await reader.getResources();

      expect(result.entityResources).not.toHaveProperty("helpers-only");
      expect(console.info).toHaveBeenCalledWith(
        "Skipping 'helpers-only' as it contains no valid definitions"
      );
    });

    test("excludes only empty entities from a mix of directories", async () => {
      fs.mkdirSync(path.join(tmpDir, "empty-a"));
      fs.mkdirSync(path.join(tmpDir, "empty-b"));

      const noTsDir = path.join(tmpDir, "no-definitions");
      fs.mkdirSync(noTsDir);
      fs.writeFileSync(path.join(noTsDir, "readme.md"), "# Hi");

      const reader = createReader(tmpDir);
      const result = await reader.getResources();

      expect(Object.keys(result.entityResources)).toEqual([]);
    });

    test("does not include non-directory entries", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "stray-file.ts"),
        "export const x = 1;"
      );

      const reader = createReader(tmpDir);
      const result = await reader.getResources();

      expect(result.entityResources).not.toHaveProperty("stray-file.ts");
      expect(console.info).toHaveBeenCalledWith(
        "Skipping 'stray-file.ts' as it is not a directory"
      );
    });
  });
});
