import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ReservedCoordinationPathError } from "../../../src/errors/ReservedCoordinationPathError.js";
import { UnsafeStagingRootError } from "../../../src/errors/UnsafeStagingRootError.js";
import { resolveGenerationPaths } from "../../../src/services/internal/generatorPreflight.js";
import { canonicalHostTempDirectory } from "../../../src/services/internal/hostTemp.js";
import {
  assertGenerationOutputAllowed,
  createStagingAuthority,
  isStagingAuthority,
} from "../../../src/services/internal/stagingAuthority.js";

const tempDirs: string[] = [];

const createTempDir = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-authority-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("generation output authority", () => {
  test("allows an ordinary configured output", () => {
    const workspace = createTempDir("configured");
    expect(() =>
      assertGenerationOutputAllowed({
        outputDir: path.join(workspace, "generated", "output"),
      })
    ).not.toThrow();
  });

  test("rejects a reserved configured output", () => {
    expect(() =>
      assertGenerationOutputAllowed({
        outputDir: path.join(
          canonicalHostTempDirectory(),
          `.typeweaver-output-lock-${"a".repeat(64)}`
        ),
      })
    ).toThrow(ReservedCoordinationPathError);
  });

  test("rejects a forged authority object", () => {
    const workspace = createTempDir("forged");
    expect(() =>
      assertGenerationOutputAllowed({
        outputDir: path.join(workspace, "generated"),
        stagingAuthority: {},
      })
    ).toThrow(ReservedCoordinationPathError);
  });

  test("allows a staged output that descends from its authority stage", () => {
    const stageRoot = createTempDir("stage");
    const authority = createStagingAuthority(stageRoot);
    expect(isStagingAuthority(authority)).toBe(true);
    expect(() =>
      assertGenerationOutputAllowed({
        outputDir: path.join(stageRoot, "mirror-1", "output"),
        stagingAuthority: authority,
      })
    ).not.toThrow();
  });

  test("rejects a staged authority whose output escapes the stage", () => {
    const stageRoot = createTempDir("stage-escape");
    const outside = path.join(path.dirname(stageRoot), "outside");
    const authority = createStagingAuthority(stageRoot);
    expect(() =>
      assertGenerationOutputAllowed({
        outputDir: outside,
        stagingAuthority: authority,
      })
    ).toThrow(UnsafeStagingRootError);
  });

  test("does not accept an object that only copies the token shape", () => {
    const stageRoot = createTempDir("token-shape");
    expect(
      isStagingAuthority({
        stageRoot,
        token: Symbol("typeweaver/staging-authority"),
      })
    ).toBe(false);
  });

  test("authority bypasses only the staged output, never the source", () => {
    const stageRoot = createTempDir("authority-stage");
    const workspace = createTempDir("authority-source");
    const authority = createStagingAuthority(stageRoot);

    expect(() =>
      resolveGenerationPaths({
        inputFile: "spec/index.ts",
        outputDir: path.join(stageRoot, "output"),
        currentWorkingDirectory: workspace,
        stagingAuthority: authority,
      })
    ).not.toThrow();

    const reservedCwd = path.join(
      canonicalHostTempDirectory(),
      "typeweaver-check-Ab12Z9"
    );
    expect(() =>
      resolveGenerationPaths({
        inputFile: "spec/index.ts",
        outputDir: path.join(stageRoot, "output"),
        currentWorkingDirectory: reservedCwd,
        stagingAuthority: authority,
      })
    ).toThrow(ReservedCoordinationPathError);
  });
});
