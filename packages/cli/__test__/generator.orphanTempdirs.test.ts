import fs from "node:fs";
import path from "node:path";
import {
  coordinationArtifactMarkerSource,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
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

const runGenerate = (
  workspace: string,
  clean: boolean,
  format = false
): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format,
        clean,
      },
      currentWorkingDirectory: workspace,
    })
  );

const markCoordinationArtifact = (
  directory: string,
  kind: "atomic-write-temp" | "spec-bundler-temp"
): void => {
  fs.writeFileSync(
    path.join(directory, TYPEWEAVER_COORDINATION_MARKER_FILE),
    coordinationArtifactMarkerSource(kind),
    {
      flag: "wx",
      mode: 0o600,
    }
  );
};

const writeSymlinkedCoordinationMarker = (
  directory: string,
  externalMarker: string
): void => {
  fs.writeFileSync(
    externalMarker,
    coordinationArtifactMarkerSource("atomic-write-temp")
  );
  fs.symlinkSync(
    externalMarker,
    path.join(directory, TYPEWEAVER_COORDINATION_MARKER_FILE)
  );
};

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
    markCoordinationArtifact(orphanDir, "atomic-write-temp");
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
    markCoordinationArtifact(buriedOrphan, "atomic-write-temp");
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
    markCoordinationArtifact(crashedStagingDir, "spec-bundler-temp");
    fs.writeFileSync(
      path.join(crashedStagingDir, "spec-entrypoint.ts"),
      "// stale wrapper from a killed process\n"
    );
    fs.writeFileSync(
      path.join(crashedStagingDir, "spec.js"),
      "// partial stale bundle\n"
    );
    const userOwnedDir = path.join(specDir, ".typeweaver-spec-loader-Z9Y8X7");
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
    expect(
      fs
        .readdirSync(specDir)
        .filter(entry =>
          /^\.typeweaver-spec-loader-[A-Za-z0-9]{6}$/.test(entry)
        )
    ).toEqual([path.basename(userOwnedDir)]);
    expect(fs.readFileSync(path.join(userOwnedDir, "notes.txt"), "utf8")).toBe(
      "preserve this directory\n"
    );
  });

  test("preserves and formats an exact-shaped user directory with a symlinked marker", async () => {
    const workspace = createTempWorkspace("formatter-skip");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    fs.mkdirSync(outputDir, { recursive: true });

    const userOwnedDir = path.join(outputDir, ".typeweaver-Ab12Z9");
    const externalMarker = path.join(workspace, "user-marker");
    fs.mkdirSync(userOwnedDir, { recursive: true });
    writeSymlinkedCoordinationMarker(userOwnedDir, externalMarker);
    fs.writeFileSync(
      path.join(userOwnedDir, ".typeweaver-output.ts"),
      "export const userOwned=true;\n"
    );

    await expect(runGenerate(workspace, false, true)).resolves.toBeUndefined();
    expect(
      fs.readFileSync(path.join(userOwnedDir, ".typeweaver-output.ts"), "utf8")
    ).toBe("export const userOwned = true;\n");
  });
});
