import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LegacyOutputLockError } from "../../../src/errors/LegacyOutputLockError.js";
import {
  acquireOutputLock,
  releaseOutputLock,
} from "../../../src/services/generatorIO.js";
import { canonicalHostTempDirectory } from "../../../src/services/internal/hostTemp.js";
import {
  inspectLegacyOutputLock,
  isCompleteLegacyOutputLock,
  isLiveLegacyOutputLock,
  normalizeOutputPathForLock,
  outputLockDirectory,
} from "../../../src/services/internal/outputCoordinationArtifact.js";

const tempDirs: string[] = [];

const createTempDir = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-lock-id-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeLegacyLock = (
  outputDir: string,
  info: Record<string, unknown> | string,
  lockName = ".typeweaver-lock"
): string => {
  const lockDir = path.join(outputDir, lockName);
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(
    path.join(lockDir, "info.json"),
    typeof info === "string" ? info : JSON.stringify(info)
  );
  return lockDir;
};

const completeLegacyInfo = (pid: number): Record<string, unknown> => ({
  pid,
  startedAt: "2026-05-17T12:00:00.000Z",
  inputFile: "",
  ownerToken: `owner-${String(pid)}`,
});

const symlinkDirectory = (target: string, linkPath: string): void => {
  fs.symlinkSync(
    target,
    linkPath,
    process.platform === "win32" ? "junction" : "dir"
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("output lock identity", () => {
  test("is deterministic for equivalent normalized paths", () => {
    const absolute = path.join("/workspace", "generated", "output");
    const withTraversal = path.join(
      "/workspace",
      "generated",
      "nested",
      "..",
      "output"
    );

    expect(normalizeOutputPathForLock(absolute)).toBe(
      normalizeOutputPathForLock(withTraversal)
    );
    expect(outputLockDirectory(absolute)).toBe(
      outputLockDirectory(withTraversal)
    );
  });

  test("collapses symlink aliases and nonexistent descendants to one identity", () => {
    const realRoot = createTempDir("alias-real");
    const aliasRoot = path.join(
      path.dirname(realRoot),
      `${path.basename(realRoot)}-alias`
    );
    symlinkDirectory(realRoot, aliasRoot);
    tempDirs.push(aliasRoot);

    expect(outputLockDirectory(aliasRoot)).toBe(outputLockDirectory(realRoot));
    expect(outputLockDirectory(path.join(aliasRoot, "future", "output"))).toBe(
      outputLockDirectory(path.join(realRoot, "future", "output"))
    );
  });

  test("keeps one identity when a missing mixed-case path is later created", () => {
    const workspace = createTempDir("transition");
    const missingMixedCase = path.join(workspace, "Generated", "Output");
    const before = outputLockDirectory(missingMixedCase);

    fs.mkdirSync(missingMixedCase, { recursive: true });
    expect(outputLockDirectory(missingMixedCase)).toBe(before);

    // A different-case spelling addresses the same physical output on
    // case-insensitive filesystems and must not split the lock.
    expect(
      outputLockDirectory(path.join(workspace, "generated", "output"))
    ).toBe(before);
  });

  test("folds case for existing paths too, preferring contention over split locks", () => {
    const workspace = createTempDir("case-fold");
    fs.mkdirSync(path.join(workspace, "alpha"));
    expect(outputLockDirectory(path.join(workspace, "alpha"))).toBe(
      outputLockDirectory(path.join(workspace, "ALPHA"))
    );
  });

  test("places the flat lock directly under the trusted temp root", () => {
    const outputDir = path.join("/workspace", "generated", "output");
    const lockDir = outputLockDirectory(outputDir);

    expect(path.dirname(lockDir)).toBe(canonicalHostTempDirectory());
    expect(path.basename(lockDir).startsWith(".typeweaver-output-lock-")).toBe(
      true
    );
  });
});

describe("legacy in-output lock classification", () => {
  test("reports none when the output directory or lock is absent", () => {
    const workspace = createTempDir("legacy-none");
    expect(inspectLegacyOutputLock(path.join(workspace, "missing"))).toEqual({
      _tag: "None",
    });
    expect(inspectLegacyOutputLock(workspace)).toEqual({ _tag: "None" });
  });

  test("reports a live legacy holder", () => {
    const workspace = createTempDir("legacy-live");
    writeLegacyLock(workspace, completeLegacyInfo(process.pid));

    const state = inspectLegacyOutputLock(workspace);
    expect(state._tag).toBe("Held");
    if (state._tag === "Held") {
      expect(state.reason).toBe("held");
      expect(state.holder?.pid).toBe(process.pid);
    }
  });

  test("reports malformed legacy metadata as ownership-uncertain", () => {
    const workspace = createTempDir("legacy-malformed");
    writeLegacyLock(workspace, '{"pid":');

    expect(inspectLegacyOutputLock(workspace)).toEqual(
      expect.objectContaining({ _tag: "Held", reason: "malformed" })
    );
  });

  test("does not follow a symlinked info.json", () => {
    const workspace = createTempDir("legacy-symlink-info");
    const lockDir = path.join(workspace, ".typeweaver-lock");
    fs.mkdirSync(lockDir);
    const externalInfo = path.join(workspace, "external.json");
    fs.writeFileSync(externalInfo, JSON.stringify(completeLegacyInfo(4242)));
    fs.symlinkSync(externalInfo, path.join(lockDir, "info.json"));

    expect(isCompleteLegacyOutputLock(lockDir, ".typeweaver-lock")).toBe(false);
    expect(inspectLegacyOutputLock(workspace)).toEqual(
      expect.objectContaining({ _tag: "Held", reason: "malformed" })
    );
  });

  test("reports a provably dead legacy holder as stale", () => {
    const workspace = createTempDir("legacy-dead");
    const deadPid = 99_999_999;
    writeLegacyLock(workspace, completeLegacyInfo(deadPid));
    const lookup = vi.spyOn(process, "kill").mockImplementation(pid => {
      if (pid === deadPid) {
        throw Object.assign(new Error("no such process"), { code: "ESRCH" });
      }
      return true;
    });

    const state = inspectLegacyOutputLock(workspace);
    lookup.mockRestore();
    expect(state._tag).toBe("Stale");
  });

  test("ignores fence-shaped directories and files", () => {
    const workspace = createTempDir("legacy-fence");
    const fenceName = `.typeweaver-lock.fence-${"a".repeat(24)}`;
    writeLegacyLock(workspace, completeLegacyInfo(99_999_999), fenceName);
    fs.writeFileSync(path.join(workspace, "lookalike-file"), "x");

    expect(inspectLegacyOutputLock(workspace)).toEqual({ _tag: "None" });
    expect(
      isCompleteLegacyOutputLock(path.join(workspace, fenceName), fenceName)
    ).toBe(false);
  });

  test("ignores a regular file that merely uses the legacy lock name", () => {
    const workspace = createTempDir("legacy-file");
    fs.writeFileSync(path.join(workspace, ".typeweaver-lock"), "not a lock");

    expect(inspectLegacyOutputLock(workspace)).toEqual({ _tag: "None" });
    expect(
      isCompleteLegacyOutputLock(
        path.join(workspace, ".typeweaver-lock"),
        ".typeweaver-lock"
      )
    ).toBe(false);
  });

  test("classifies a complete legacy lock as live only for a live owner", () => {
    const workspace = createTempDir("legacy-live-classify");
    const liveLock = writeLegacyLock(
      workspace,
      completeLegacyInfo(process.pid)
    );
    expect(isLiveLegacyOutputLock(liveLock, ".typeweaver-lock")).toBe(true);

    const deadWorkspace = createTempDir("legacy-dead-classify");
    const deadPid = 99_999_999;
    const deadLock = writeLegacyLock(
      deadWorkspace,
      completeLegacyInfo(deadPid)
    );
    const lookup = vi.spyOn(process, "kill").mockImplementation(pid => {
      if (pid === deadPid) {
        throw Object.assign(new Error("no such process"), { code: "ESRCH" });
      }
      return true;
    });
    expect(isLiveLegacyOutputLock(deadLock, ".typeweaver-lock")).toBe(false);
    lookup.mockRestore();
  });
});

describe("legacy lock acquisition behavior", () => {
  test("fails closed with LegacyOutputLockError for a live legacy lock", async () => {
    const workspace = createTempDir("acquire-live");
    const lockDir = writeLegacyLock(workspace, completeLegacyInfo(process.pid));

    const exit = await Effect.runPromiseExit(
      acquireOutputLock({
        outputDir: workspace,
        inputFile: path.join(workspace, "spec.ts"),
      })
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(LegacyOutputLockError);
      }
    }
    expect(fs.existsSync(lockDir)).toBe(true);
  });
  test("treats a dead legacy lock as stale and acquires the out-of-band lock", async () => {
    const workspace = createTempDir("acquire-dead");
    const deadPid = 99_999_999;
    writeLegacyLock(workspace, completeLegacyInfo(deadPid));
    const lookup = vi.spyOn(process, "kill").mockImplementation(pid => {
      if (pid === deadPid) {
        throw Object.assign(new Error("no such process"), { code: "ESRCH" });
      }
      return true;
    });

    const lock = await Effect.runPromise(
      acquireOutputLock({
        outputDir: workspace,
        inputFile: path.join(workspace, "spec.ts"),
      })
    );
    lookup.mockRestore();
    await Effect.runPromise(releaseOutputLock(lock));
  });
});

describe("flat lock release and private modes", () => {
  test("removes the lock and its fence directly under the temp root", async () => {
    const workspace = createTempDir("release-flat");
    const outputDir = path.join(workspace, "generated");
    const lock = await Effect.runPromise(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(workspace, "spec.ts"),
      })
    );
    const lockPath = lock.path;

    await Effect.runPromise(releaseOutputLock(lock));

    expect(fs.existsSync(lockPath)).toBe(false);
    const leftoverFences = fs
      .readdirSync(path.dirname(lockPath))
      .filter(entry => entry.startsWith(`${path.basename(lockPath)}.fence-`));
    expect(leftoverFences).toEqual([]);
  });
  test("creates a 0700 lock directory and 0600 metadata under a permissive umask", async () => {
    if (process.platform === "win32") {
      return;
    }
    const workspace = createTempDir("lock-modes");
    const outputDir = path.join(workspace, "generated");
    const previousUmask = process.umask(0);
    let lockPath: string;
    try {
      const lock = await Effect.runPromise(
        acquireOutputLock({
          outputDir,
          inputFile: path.join(workspace, "spec.ts"),
        })
      );
      lockPath = lock.path;
      expect(fs.lstatSync(lockPath).mode & 0o777).toBe(0o700);
      expect(fs.lstatSync(path.join(lockPath, "info.json")).mode & 0o777).toBe(
        0o600
      );
      await Effect.runPromise(releaseOutputLock(lock));
    } finally {
      process.umask(previousUmask);
    }
    expect(lockPath).toBeDefined();
  });
});
