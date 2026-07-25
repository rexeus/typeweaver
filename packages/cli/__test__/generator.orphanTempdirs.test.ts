import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";

const tempDirs: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-orphan-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpec = (workspace: string): void => {
  const specFile = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      'import { z } from "zod";',
      "",
      "const itemLoaded = defineResponse({",
      '  name: "ItemLoaded",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "Item loaded",',
      "  body: z.object({ id: z.string() }),",
      "});",
      "",
      "export const spec = defineSpec({",
      "  resources: {",
      "    item: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "getItem",',
      '          path: "/items/:itemId",',
      "          method: HttpMethod.GET,",
      '          summary: "Get item",',
      "          request: { param: z.object({ itemId: z.string() }) },",
      "          responses: [itemLoaded],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );
};

const runGenerate = (workspace: string, clean: boolean): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
        clean,
      },
      currentWorkingDirectory: workspace,
    })
  );

describe("Generator orphan tempdir hygiene", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("sweeps an orphan `.typeweaver-XXXX` tempdir before the pipeline runs with --no-clean", async () => {
    const workspace = createTempWorkspace("sweep");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    // Simulate a prior run that died between `mkdtempSync` and the
    // `try/finally` cleanup. The Formatter would otherwise walk into
    // this dir and read/rewrite the `.tmp` content.
    const orphanDir = path.join(outputDir, ".typeweaver-abc123");
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(
      path.join(orphanDir, "generated.tmp"),
      "// stale in-flight content\n"
    );

    await runGenerate(workspace, false);

    expect(fs.existsSync(orphanDir)).toBe(false);
    expect(
      fs.existsSync(path.join(outputDir, "item", "GetItemRequest.ts"))
    ).toBe(true);
  });

  test("sweeps a nested orphan tempdir buried inside a resource directory", async () => {
    const workspace = createTempWorkspace("nested");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");

    const buriedOrphan = path.join(outputDir, "item", ".typeweaver-a1B2c3");
    fs.mkdirSync(buriedOrphan, { recursive: true });
    fs.writeFileSync(
      path.join(buriedOrphan, "generated.tmp"),
      "// stale buried content\n"
    );

    await runGenerate(workspace, false);

    expect(fs.existsSync(buriedOrphan)).toBe(false);
  });

  test("sweeps crashed spec-bundler staging without deleting similarly named user content", async () => {
    const workspace = createTempWorkspace("spec-loader-sweep");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const specDir = path.join(outputDir, "spec");
    fs.mkdirSync(specDir, { recursive: true });

    const crashedStagingDir = fs.mkdtempSync(
      path.join(specDir, ".typeweaver-spec-loader-")
    );
    fs.writeFileSync(
      path.join(crashedStagingDir, "spec-entrypoint.ts"),
      "// stale wrapper from a killed process\n"
    );
    fs.writeFileSync(
      path.join(crashedStagingDir, "spec.js"),
      "// partial stale bundle\n"
    );
    const userOwnedDir = path.join(
      specDir,
      ".typeweaver-spec-loader-user-owned"
    );
    fs.mkdirSync(userOwnedDir);
    fs.writeFileSync(
      path.join(userOwnedDir, "notes.txt"),
      "preserve this directory\n"
    );

    await runGenerate(workspace, false);

    expect(fs.existsSync(crashedStagingDir)).toBe(false);
    expect(fs.existsSync(path.join(specDir, "spec.js"))).toBe(true);
    expect(
      fs.existsSync(path.join(outputDir, "item", "GetItemRequest.ts"))
    ).toBe(true);
    expect(fs.readdirSync(specDir)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\.typeweaver-spec-loader-[A-Za-z0-9]{6}$/),
      ])
    );
    expect(fs.readFileSync(path.join(userOwnedDir, "notes.txt"), "utf8")).toBe(
      "preserve this directory\n"
    );
  });

  test("preserves user-owned `.typeweaver-*` directories while formatting", async () => {
    // Even though the sweep runs first, the Formatter's own guard is the
    // belt-and-braces for tempdirs created by concurrent atomic-replace
    // writes. Pre-seed an orphan that survives any sweep window and assert
    // the formatter does not crash on its `.tmp` content. Tempdirs that
    // use the reserved prefix without matching the exact six-character
    // mkdtemp artifact shape, so the assertion covers both formatter safety
    // and preservation of user-owned content.
    const workspace = createTempWorkspace("formatter-skip");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    fs.mkdirSync(outputDir, { recursive: true });

    const orphanDir = path.join(outputDir, ".typeweaver-formatter-test");
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(
      path.join(orphanDir, "generated.tmp"),
      "this content would crash a formatter that walks .tmp files\n"
    );

    await expect(runGenerate(workspace, false)).resolves.toBeUndefined();
    expect(fs.existsSync(orphanDir)).toBe(true);
    expect(fs.readFileSync(path.join(orphanDir, "generated.tmp"), "utf8")).toBe(
      "this content would crash a formatter that walks .tmp files\n"
    );
  });
});
