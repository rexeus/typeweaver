import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ReservedCoordinationPathError } from "../../../src/errors/index.js";
import { resolveGenerationPaths } from "../../../src/services/internal/generatorPreflight.js";
import { canonicalHostTempDirectory } from "../../../src/services/internal/hostTemp.js";

const tempDirs: string[] = [];

const makeWorkspace = (): string => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-preflight-reserved-")
  );
  tempDirs.push(workspace);
  return workspace;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("generator preflight reserved source validation", () => {
  test("rejects a working directory inside the reserved namespace", () => {
    const reservedCwd = path.join(
      canonicalHostTempDirectory(),
      "typeweaver-check-Ab12Z9"
    );

    expect(() =>
      resolveGenerationPaths({
        inputFile: "spec/index.ts",
        outputDir: "generated",
        currentWorkingDirectory: reservedCwd,
      })
    ).toThrow(ReservedCoordinationPathError);
  });

  test("rejects an input directory inside the reserved namespace", () => {
    const workspace = makeWorkspace();
    const reservedInput = path.join(
      canonicalHostTempDirectory(),
      `.typeweaver-output-lock-${"a".repeat(64)}`,
      "spec",
      "index.ts"
    );

    expect(() =>
      resolveGenerationPaths({
        inputFile: reservedInput,
        outputDir: "generated",
        currentWorkingDirectory: workspace,
      })
    ).toThrow(ReservedCoordinationPathError);
  });

  test("rejects a flat lock fence name used as the configured output", () => {
    const workspace = makeWorkspace();
    const fenceOutput = path.join(
      canonicalHostTempDirectory(),
      `.typeweaver-output-lock-${"a".repeat(64)}.fence-${"b".repeat(24)}`
    );

    expect(() =>
      resolveGenerationPaths({
        inputFile: "spec/index.ts",
        outputDir: fenceOutput,
        currentWorkingDirectory: workspace,
      })
    ).toThrow(ReservedCoordinationPathError);
  });
});
