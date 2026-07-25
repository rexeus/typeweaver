import fs from "node:fs";
import path from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  acquireOutputLock,
  assertSafeCleanTargetEffectWith,
  cleanOutputDirPreservingLock,
  releaseOutputLockStrict,
} from "../../src/services/generatorIO.js";
import type { CleanTargetFs } from "../../src/services/cleanTargetGuard.js";
import type { OutputLock } from "../../src/services/generatorIO.js";

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-io-errors-")
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const expectedSystemError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`simulated ${code}`), {
    code,
    errno: -1,
    syscall: "test",
  });

const expectTypedFailureWithoutDefects = <E extends { readonly _tag: string }>(
  exit: Exit.Exit<unknown, E>,
  expectedTag: E["_tag"]
): E => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected effect to fail");
  }
  expect(Array.from(Cause.defects(exit.cause))).toEqual([]);
  const failure = Cause.failureOption(exit.cause);
  expect(failure._tag).toBe("Some");
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure: ${Cause.pretty(exit.cause)}`);
  }
  expect(failure.value._tag).toBe(expectedTag);
  return failure.value;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("generator filesystem errors", () => {
  test("reports clean-target permission failures without defects", () => {
    const outputDir = "/workspace/generated";
    const cause = expectedSystemError("EACCES");
    const fileSystem: CleanTargetFs = {
      exists: () => true,
      readFileString: () => "{}",
      realPath: () => {
        throw cause;
      },
    };

    const exit = Effect.runSyncExit(
      assertSafeCleanTargetEffectWith(outputDir, "/workspace", fileSystem)
    );
    const failure = expectTypedFailureWithoutDefects(
      exit,
      "CleanTargetInspectionError"
    );

    expect(failure).toEqual(
      expect.objectContaining({
        outputDir,
        cause,
        _tag: "CleanTargetInspectionError",
      })
    );
  });

  test("keeps unexpected clean-target throws as defects", () => {
    const programmingError = new Error("broken fake");
    const fileSystem: CleanTargetFs = {
      exists: () => true,
      readFileString: () => "{}",
      realPath: () => {
        throw programmingError;
      },
    };

    const exit = Effect.runSyncExit(
      assertSafeCleanTargetEffectWith(
        "/workspace/generated",
        "/workspace",
        fileSystem
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Array.from(Cause.failures(exit.cause))).toEqual([]);
      expect(Array.from(Cause.defects(exit.cause))).toEqual([programmingError]);
    }
  });

  test("reports clean removal failures without defects", () => {
    const outputDir = createTempDir();
    fs.writeFileSync(path.join(outputDir, "generated.ts"), "content");
    const cause = expectedSystemError("EACCES");
    vi.spyOn(fs, "rmSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(cleanOutputDirPreservingLock(outputDir));
    const failure = expectTypedFailureWithoutDefects(exit, "OutputCleanError");

    expect(failure).toEqual(
      expect.objectContaining({ outputDir, cause, _tag: "OutputCleanError" })
    );
  });

  test("keeps unexpected clean-step throws as defects", () => {
    const outputDir = createTempDir();
    fs.writeFileSync(path.join(outputDir, "generated.ts"), "content");
    const programmingError = new TypeError("broken clean adapter");
    vi.spyOn(fs, "rmSync").mockImplementationOnce(() => {
      throw programmingError;
    });

    const exit = Effect.runSyncExit(cleanOutputDirPreservingLock(outputDir));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Array.from(Cause.failures(exit.cause))).toEqual([]);
      expect(Array.from(Cause.defects(exit.cause))).toEqual([programmingError]);
    }
  });
});

describe("generator output-lock filesystem errors", () => {
  test("reports lock acquisition permission failures without defects", () => {
    const outputDir = createTempDir();
    const cause = expectedSystemError("EACCES");
    vi.spyOn(fs, "mkdirSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(outputDir, "spec.ts"),
      })
    );
    const failure = expectTypedFailureWithoutDefects(exit, "OutputLockError");

    expect(failure).toEqual(
      expect.objectContaining({
        outputDir,
        lockPath: path.join(outputDir, ".typeweaver-lock"),
        operation: "acquire",
        cause,
      })
    );
  });

  test("does not misreport unreadable lock metadata as contention", () => {
    const outputDir = createTempDir();
    const lockPath = path.join(outputDir, ".typeweaver-lock");
    fs.mkdirSync(lockPath);
    fs.writeFileSync(path.join(lockPath, "info.json"), "{}");
    const cause = expectedSystemError("EACCES");
    vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(outputDir, "spec.ts"),
      })
    );
    const failure = expectTypedFailureWithoutDefects(exit, "OutputLockError");

    expect(failure).toEqual(
      expect.objectContaining({
        outputDir,
        lockPath,
        operation: "acquire",
        cause,
      })
    );
  });
});

describe("generator output-lock release errors", () => {
  test("recognizes platform-specific filesystem errors outside a fixed allowlist", () => {
    const outputDir = createTempDir();
    const lockPath = path.join(outputDir, ".typeweaver-lock");
    fs.mkdirSync(lockPath);
    fs.writeFileSync(path.join(lockPath, "info.json"), "{}");
    const cause = expectedSystemError("EISDIR");
    vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(outputDir, "spec.ts"),
      })
    );
    const failure = expectTypedFailureWithoutDefects(exit, "OutputLockError");

    expect(failure).toEqual(
      expect.objectContaining({
        outputDir,
        lockPath,
        operation: "acquire",
        cause,
      })
    );
  });

  test("reports strict lock release permission failures without defects", () => {
    const outputDir = createTempDir();
    const lockPath = path.join(outputDir, ".typeweaver-lock");
    const lock: OutputLock = { path: lockPath, ownerToken: "owned" };
    fs.mkdirSync(lockPath);
    fs.writeFileSync(
      path.join(lockPath, "info.json"),
      JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        inputFile: "spec.ts",
        ownerToken: lock.ownerToken,
      })
    );
    const cause = expectedSystemError("EPERM");
    vi.spyOn(fs, "rmSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(releaseOutputLockStrict(lock));
    const failure = expectTypedFailureWithoutDefects(exit, "OutputLockError");

    expect(failure).toEqual(
      expect.objectContaining({
        outputDir,
        lockPath,
        operation: "release",
        cause,
      })
    );
  });
});
