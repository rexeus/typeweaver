import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { cleanOutputDirPreservingLock } from "../../src/services/generatorIO.js";
import { isLiveLegacyOutputLock } from "../../src/services/internal/outputCoordinationArtifact.js";

const tempDirs: string[] = [];

const createTempDir = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-legacy-clean-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeLockDir = (outputDir: string, name: string, pid: number): string => {
  const lockDir = path.join(outputDir, name);
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(
    path.join(lockDir, "info.json"),
    JSON.stringify({
      pid,
      startedAt: "2026-05-17T12:00:00.000Z",
      inputFile: "",
      ownerToken: `owner-${String(pid)}`,
    })
  );
  return lockDir;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("clean remediates unproven legacy artifacts", () => {
  test("removes dead locks, fences, and lookalikes but preserves a live lock", async () => {
    const outputDir = createTempDir("clean");
    const liveLock = writeLockDir(outputDir, ".typeweaver-lock", process.pid);
    const deadLock = writeLockDir(
      outputDir,
      ".typeweaver-lock.fence-aaaaaaaaaaaaaaaaaaaaaaaa",
      99_999_999
    );
    fs.writeFileSync(
      path.join(outputDir, ".typeweaver-lock.fence-bbbbbbbbbbbbbbbbbbbbbbbb"),
      "fence file"
    );
    fs.writeFileSync(path.join(outputDir, "lookalike"), "user content");
    fs.writeFileSync(path.join(outputDir, "generated.ts"), "export {};\n");

    await Effect.runPromise(cleanOutputDirPreservingLock(outputDir));

    // A live proven legacy lock is the only entry preserved.
    expect(fs.existsSync(path.join(liveLock, "info.json"))).toBe(true);
    expect(fs.existsSync(deadLock)).toBe(false);
    expect(
      fs.existsSync(
        path.join(outputDir, ".typeweaver-lock.fence-bbbbbbbbbbbbbbbbbbbbbbbb")
      )
    ).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "lookalike"))).toBe(false);
    expect(fs.existsSync(path.join(outputDir, "generated.ts"))).toBe(false);
  });

  test("removes a regular file that merely uses the legacy lock name", async () => {
    const outputDir = createTempDir("file");
    const lockFile = path.join(outputDir, ".typeweaver-lock");
    fs.writeFileSync(lockFile, "not a lock");

    await Effect.runPromise(cleanOutputDirPreservingLock(outputDir));

    expect(fs.existsSync(lockFile)).toBe(false);
  });

  test("removes ordinary directories that merely contain lock-shaped metadata", async () => {
    const outputDir = createTempDir("lookalike");
    const lookalike = writeLockDir(outputDir, "backup", process.pid);
    const otherLookalike = writeLockDir(outputDir, "archive", 99_999_999);

    // The basename guard means these are never treated as live locks.
    expect(isLiveLegacyOutputLock(lookalike, "backup")).toBe(false);
    expect(isLiveLegacyOutputLock(otherLookalike, "archive")).toBe(false);

    await Effect.runPromise(cleanOutputDirPreservingLock(outputDir));

    expect(fs.existsSync(lookalike)).toBe(false);
    expect(fs.existsSync(otherLookalike)).toBe(false);
  });
});
