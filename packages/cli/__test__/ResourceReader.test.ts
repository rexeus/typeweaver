import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceReader } from "../src/generators/ResourceReader.js";
import { ReservedEntityNameError } from "../src/generators/errors/ReservedEntityNameError";
import { ReservedKeywordError } from "../src/generators/errors/ReservedKeywordError";
import { catchErrorAsync } from "./helpers";

describe("ResourceReader", () => {
  let tmpDir: string;
  let tmpOutputDir: string;
  let tmpSharedDir: string;
  let tmpSharedOutputDir: string;

  const createReader = () =>
    new ResourceReader({
      sourceDir: tmpDir,
      outputDir: tmpOutputDir,
      sharedSourceDir: tmpSharedDir,
      sharedOutputDir: tmpSharedOutputDir,
    });

  beforeEach(() => {
    tmpOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-out-"));
    tmpSharedOutputDir = path.join(tmpOutputDir, "shared");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpOutputDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("empty entity handling", () => {
    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-src-"));
      tmpSharedDir = path.join(tmpDir, "shared");
    });

    test("skips empty entity directory", async () => {
      fs.mkdirSync(path.join(tmpDir, "empty-entity"));

      const result = await createReader().getResources();

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

      const result = await createReader().getResources();

      expect(result.entityResources).not.toHaveProperty("no-ts-files");
    });

    test("skips entity directory with only non-definition .ts files", async () => {
      const entityDir = path.join(tmpDir, "helpers-only");
      fs.mkdirSync(entityDir);
      fs.writeFileSync(
        path.join(entityDir, "helperSchema.ts"),
        "export default { foo: 'bar' };\n"
      );

      const result = await createReader().getResources();

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

      const result = await createReader().getResources();

      expect(Object.keys(result.entityResources)).toEqual([]);
    });

    test("does not include non-directory entries", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "stray-file.ts"),
        "export const x = 1;"
      );

      const result = await createReader().getResources();

      expect(result.entityResources).not.toHaveProperty("stray-file.ts");
      expect(console.info).toHaveBeenCalledWith(
        "Skipping 'stray-file.ts' as it is not a directory"
      );
    });
  });

  describe("reserved entity name rejection", () => {
    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-reserved-"));
      tmpSharedDir = path.join(tmpDir, "_shared");
    });

    test.each(["shared", "lib", "definition", "index"])(
      "rejects reserved name '%s'",
      async (name) => {
        fs.mkdirSync(path.join(tmpDir, name));

        const error = (await catchErrorAsync(() =>
          createReader().getResources()
        )) as ReservedEntityNameError;

        expect(error).toBeInstanceOf(ReservedEntityNameError);
        expect(error.entityName).toBe(name);
        expect(error.file).toContain(name);
      }
    );

    test("rejects JS/TS reserved keyword as entity name", async () => {
      fs.mkdirSync(path.join(tmpDir, "delete"));

      await expect(createReader().getResources()).rejects.toThrow(
        ReservedKeywordError
      );
    });

    test("accepts valid entity names", async () => {
      fs.mkdirSync(path.join(tmpDir, "todo"));
      fs.mkdirSync(path.join(tmpDir, "account"));

      const result = await createReader().getResources();

      expect(result).toBeDefined();
    });
  });
});
