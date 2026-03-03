import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceReader } from "../src/generators/ResourceReader.js";
import { ReservedEntityNameError } from "../src/generators/errors/ReservedEntityNameError";
import { ReservedKeywordError } from "../src/generators/errors/ReservedKeywordError";

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

  describe("getResources – reserved entity name rejection", () => {
    let tmpDir: string;
    let tmpOutputDir: string;
    let tmpSharedDir: string;
    let tmpSharedOutputDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-reserved-"));
      tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-out-"));
      tmpSharedDir = path.join(tmpDir, "_shared");
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

    test.each(["shared", "lib", "definition", "index"])(
      "rejects reserved Typeweaver entity name '%s'",
      async (name) => {
        fs.mkdirSync(path.join(tmpDir, name));

        const reader = createReader(tmpDir);

        await expect(reader.getResources()).rejects.toThrow(
          ReservedEntityNameError
        );
      }
    );

    test.each(["shared", "lib", "definition", "index"])(
      "ReservedEntityNameError has correct properties for '%s'",
      async (name) => {
        fs.mkdirSync(path.join(tmpDir, name));

        const reader = createReader(tmpDir);

        try {
          await reader.getResources();
          expect.unreachable("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(ReservedEntityNameError);
          const rne = error as ReservedEntityNameError;
          expect(rne.entityName).toBe(name);
          expect(rne.file).toContain(name);
        }
      }
    );

    test("rejects JS/TS reserved keyword as entity name", async () => {
      fs.mkdirSync(path.join(tmpDir, "delete"));

      const reader = createReader(tmpDir);

      await expect(reader.getResources()).rejects.toThrow(
        ReservedKeywordError
      );
    });

    test("accepts valid entity names", async () => {
      fs.mkdirSync(path.join(tmpDir, "todo"));
      fs.mkdirSync(path.join(tmpDir, "account"));

      const reader = createReader(tmpDir);
      const result = await reader.getResources();

      expect(result).toBeDefined();
    });
  });
});
