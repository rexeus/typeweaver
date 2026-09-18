import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  coordinationArtifactMarkerSource,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  compareOutputTrees,
  snapshotOutputTree,
} from "../../src/services/outputComparison.js";

const tempDirs: string[] = [];

const makeRoot = (suffix: string): string => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-comparison-${suffix}-`)
  );
  tempDirs.push(root);
  return root;
};

const writeFile = (
  root: string,
  relativePath: string,
  content: string
): void => {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
};

const extractTypedFailure = <E extends { readonly _tag: string }>(
  exit: Exit.Exit<unknown, E>
): E => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected effect to fail");
  }
  const failure = Cause.failureOption(exit.cause);
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("output tree comparison", () => {
  test("reports a match when every regular file is byte-identical", async () => {
    const committed = makeRoot("match-committed");
    const generated = makeRoot("match-generated");
    writeFile(committed, "index.ts", "export const a = 1;\n");
    writeFile(committed, "health/PingRequest.ts", "export type T = 1;\n");
    writeFile(generated, "index.ts", "export const a = 1;\n");
    writeFile(generated, "health/PingRequest.ts", "export type T = 1;\n");

    const comparison = await Effect.runPromise(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );

    expect(comparison).toEqual({
      added: [],
      removed: [],
      changed: [],
      generatedFileCount: 2,
    });
  });

  test("reports added, removed, and changed groups with sorted POSIX paths", async () => {
    const committed = makeRoot("drift-committed");
    const generated = makeRoot("drift-generated");
    writeFile(committed, "index.ts", "shared\n");
    writeFile(committed, "removed/b.ts", "gone\n");
    writeFile(committed, "removed/a.ts", "gone\n");
    writeFile(committed, "changed/z.ts", "before\n");
    writeFile(generated, "index.ts", "shared\n");
    writeFile(generated, "changed/z.ts", "after\n");
    writeFile(generated, "added/c.ts", "new\n");
    writeFile(generated, "added/a.ts", "new\n");

    const comparison = await Effect.runPromise(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );

    expect(comparison).toEqual({
      added: ["added/a.ts", "added/c.ts"],
      removed: ["removed/a.ts", "removed/b.ts"],
      changed: ["changed/z.ts"],
      generatedFileCount: 4,
    });
  });

  test("compares binary files by bytes and never by text decoding", async () => {
    const committed = makeRoot("binary-committed");
    const generated = makeRoot("binary-generated");
    fs.writeFileSync(
      path.join(committed, "asset.bin"),
      Buffer.from([0x00, 0xff, 0x10, 0x80])
    );
    fs.writeFileSync(
      path.join(generated, "asset.bin"),
      Buffer.from([0x00, 0xff, 0x10, 0x81])
    );

    const comparison = await Effect.runPromise(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );

    expect(comparison.changed).toEqual(["asset.bin"]);
  });

  test("treats a missing committed output as fully added drift", async () => {
    const committed = makeRoot("missing-committed");
    const generated = makeRoot("missing-generated");
    fs.rmSync(committed, { recursive: true, force: true });
    writeFile(generated, "index.ts", "one\n");
    writeFile(generated, "health/PingRequest.ts", "two\n");

    const comparison = await Effect.runPromise(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );

    expect(comparison.added).toEqual(["health/PingRequest.ts", "index.ts"]);
    expect(comparison.removed).toEqual([]);
    expect(comparison.changed).toEqual([]);
  });
});

describe("output tree comparison safety", () => {
  test("rejects a symbolic link with a typed actionable error", () => {
    const committed = makeRoot("symlink-committed");
    const generated = makeRoot("symlink-generated");
    writeFile(generated, "index.ts", "one\n");
    writeFile(committed, "target.ts", "one\n");
    fs.symlinkSync(
      path.join(committed, "target.ts"),
      path.join(committed, "link.ts")
    );

    const exit = Effect.runSyncExit(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );
    const failure = extractTypedFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "UnsupportedOutputEntryError",
        relativePath: "link.ts",
        entryType: "symbolic-link",
      })
    );
    expect(failure.message).toContain("link.ts");
  });

  test("reports unreadable files as a typed comparison error without defects", () => {
    const committed = makeRoot("unreadable-committed");
    const generated = makeRoot("unreadable-generated");
    writeFile(committed, "index.ts", "one\n");
    writeFile(generated, "index.ts", "one\n");
    const cause = Object.assign(new Error("simulated EACCES"), {
      code: "EACCES",
      errno: -1,
      syscall: "read",
    });
    const unreadablePath = path.join(committed, "index.ts");
    const readFileSync = fs.readFileSync;
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementation((target, options) => {
        if (target === unreadablePath) {
          throw cause;
        }
        return readFileSync(target, options);
      });

    const exit = Effect.runSyncExit(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );
    readFileSyncSpy.mockRestore();

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Array.from(Cause.defects(exit.cause))).toEqual([]);
    }
    const failure = extractTypedFailure(exit);
    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "OutputComparisonReadError",
        relativePath: "index.ts",
        cause,
      })
    );
  });

  test("excludes confirmed coordination artifacts but not user-owned lookalikes", async () => {
    const committed = makeRoot("artifact-committed");
    const generated = makeRoot("artifact-generated");

    const markedArtifact = path.join(committed, ".typeweaver-Ab12Z9");
    fs.mkdirSync(markedArtifact, { recursive: true });
    fs.writeFileSync(
      path.join(markedArtifact, TYPEWEAVER_COORDINATION_MARKER_FILE),
      coordinationArtifactMarkerSource("atomic-write-temp")
    );
    fs.writeFileSync(path.join(markedArtifact, "generated.tmp"), "stale\n");

    const userOwned = path.join(committed, ".typeweaver-Z9y8X7");
    fs.mkdirSync(userOwned, { recursive: true });
    fs.writeFileSync(path.join(userOwned, "notes.txt"), "keep me\n");

    const comparison = await Effect.runPromise(
      compareOutputTrees({
        committedRoot: committed,
        generatedRoot: generated,
      })
    );

    expect(comparison.removed).toEqual([".typeweaver-Z9y8X7/notes.txt"]);
  });
});

describe("output tree snapshot", () => {
  test("copies every regular file byte-for-byte and creates parent directories", async () => {
    const source = makeRoot("snapshot-source");
    const destination = makeRoot("snapshot-destination");
    writeFile(source, "index.ts", "export const a = 1;\n");
    writeFile(source, "nested/deep/file.bin", "content\n");
    fs.writeFileSync(
      path.join(source, "binary.dat"),
      Buffer.from([0x00, 0x01, 0x02])
    );

    await Effect.runPromise(
      snapshotOutputTree({
        sourceRoot: source,
        destinationRoot: destination,
      })
    );

    expect(fs.readFileSync(path.join(destination, "index.ts"), "utf8")).toBe(
      "export const a = 1;\n"
    );
    expect(
      fs.readFileSync(path.join(destination, "nested/deep/file.bin"), "utf8")
    ).toBe("content\n");
    expect(fs.readFileSync(path.join(destination, "binary.dat"))).toEqual(
      Buffer.from([0x00, 0x01, 0x02])
    );
  });

  test("is a no-op when the source output does not exist", async () => {
    const source = makeRoot("snapshot-missing-source");
    const destination = makeRoot("snapshot-missing-destination");
    fs.rmSync(source, { recursive: true, force: true });

    await Effect.runPromise(
      snapshotOutputTree({
        sourceRoot: source,
        destinationRoot: destination,
      })
    );

    expect(fs.existsSync(destination)).toBe(true);
    expect(fs.readdirSync(destination)).toEqual([]);
  });

  test("rejects a symbolic link in the source tree before copying", () => {
    const source = makeRoot("snapshot-symlink-source");
    const destination = makeRoot("snapshot-symlink-destination");
    writeFile(source, "target.ts", "one\n");
    fs.symlinkSync(
      path.join(source, "target.ts"),
      path.join(source, "link.ts")
    );

    const exit = Effect.runSyncExit(
      snapshotOutputTree({
        sourceRoot: source,
        destinationRoot: destination,
      })
    );
    const failure = extractTypedFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "UnsupportedOutputEntryError",
        relativePath: "link.ts",
      })
    );
    expect(fs.existsSync(path.join(destination, "link.ts"))).toBe(false);
  });
});

describe("output tree root inspection", () => {
  test("rejects a symlinked root instead of following it", () => {
    const realRoot = makeRoot("root-symlink-real");
    const generated = makeRoot("root-symlink-generated");
    writeFile(realRoot, "index.ts", "one\n");
    const symlinkRoot = path.join(
      path.dirname(realRoot),
      `${path.basename(realRoot)}-link`
    );
    fs.symlinkSync(realRoot, symlinkRoot, "dir");
    tempDirs.push(symlinkRoot);

    const exit = Effect.runSyncExit(
      compareOutputTrees({
        committedRoot: symlinkRoot,
        generatedRoot: generated,
      })
    );
    const failure = extractTypedFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "UnsupportedOutputEntryError",
        relativePath: ".",
        entryType: "symbolic-link",
      })
    );
  });

  test("rejects a non-directory root", () => {
    const workspace = makeRoot("root-file");
    const generated = makeRoot("root-file-generated");
    const rootFile = path.join(workspace, "output-file");
    fs.writeFileSync(rootFile, "not a directory");

    const exit = Effect.runSyncExit(
      compareOutputTrees({ committedRoot: rootFile, generatedRoot: generated })
    );
    const failure = extractTypedFailure(exit);

    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "UnsupportedOutputEntryError",
        relativePath: ".",
        entryType: "other",
      })
    );
  });

  test("maps an inaccessible root to a typed read error, not a defect", () => {
    const workspace = makeRoot("root-inaccessible");
    const generated = makeRoot("root-inaccessible-generated");
    const cause = Object.assign(new Error("simulated EACCES"), {
      code: "EACCES",
      errno: -1,
      syscall: "lstat",
    });
    const rootPath = path.join(workspace, "generated");
    const lstatSync = fs.lstatSync;
    const spy = vi
      .spyOn(fs, "lstatSync")
      .mockImplementation((target, options) => {
        if (target === rootPath) {
          throw cause;
        }
        return lstatSync(target, options);
      });

    const exit = Effect.runSyncExit(
      compareOutputTrees({ committedRoot: rootPath, generatedRoot: generated })
    );
    spy.mockRestore();

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Array.from(Cause.defects(exit.cause))).toEqual([]);
    }
    expect(extractTypedFailure(exit)).toEqual(
      expect.objectContaining({ _tag: "OutputComparisonReadError", cause })
    );
  });
});

describe("output tree coordination exclusion is evidence-based", () => {
  test("compares a regular file named like the legacy lock directory", async () => {
    const committed = makeRoot("lookalike-lock-file");
    const generated = makeRoot("lookalike-lock-file-generated");
    fs.writeFileSync(path.join(committed, ".typeweaver-lock"), "user data\n");

    const comparison = await Effect.runPromise(
      compareOutputTrees({ committedRoot: committed, generatedRoot: generated })
    );

    expect(comparison.removed).toEqual([".typeweaver-lock"]);
  });

  test("compares a fence-shaped regular file", async () => {
    const committed = makeRoot("lookalike-fence-file");
    const generated = makeRoot("lookalike-fence-file-generated");
    const fenceName = `.typeweaver-lock.fence-${"b".repeat(24)}`;
    fs.writeFileSync(path.join(committed, fenceName), "user data\n");

    const comparison = await Effect.runPromise(
      compareOutputTrees({ committedRoot: committed, generatedRoot: generated })
    );

    expect(comparison.removed).toEqual([fenceName]);
  });

  test("compares a bare coordination marker file outside a marked directory", async () => {
    const committed = makeRoot("lookalike-marker-file");
    const generated = makeRoot("lookalike-marker-file-generated");
    fs.writeFileSync(
      path.join(committed, TYPEWEAVER_COORDINATION_MARKER_FILE),
      "user data\n"
    );

    const comparison = await Effect.runPromise(
      compareOutputTrees({ committedRoot: committed, generatedRoot: generated })
    );

    expect(comparison.removed).toEqual([TYPEWEAVER_COORDINATION_MARKER_FILE]);
  });

  test("compares a legacy-lock-named directory with malformed metadata", async () => {
    const committed = makeRoot("lookalike-malformed-lock");
    const generated = makeRoot("lookalike-malformed-lock-generated");
    const lockDir = path.join(committed, ".typeweaver-lock");
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, "info.json"), "{}");

    const comparison = await Effect.runPromise(
      compareOutputTrees({ committedRoot: committed, generatedRoot: generated })
    );

    expect(comparison.removed).toEqual([".typeweaver-lock/info.json"]);
  });

  test("excludes a directory whose complete metadata proves it is a legacy lock", async () => {
    const committed = makeRoot("complete-legacy-lock");
    const generated = makeRoot("complete-legacy-lock-generated");
    const lockDir = path.join(committed, ".typeweaver-lock");
    fs.mkdirSync(lockDir);
    fs.writeFileSync(
      path.join(lockDir, "info.json"),
      JSON.stringify({
        pid: 4242,
        startedAt: "2026-05-17T12:00:00.000Z",
        inputFile: "",
        ownerToken: "legacy",
      })
    );

    const comparison = await Effect.runPromise(
      compareOutputTrees({ committedRoot: committed, generatedRoot: generated })
    );

    expect(comparison).toEqual({
      added: [],
      removed: [],
      changed: [],
      generatedFileCount: 0,
    });
  });

  test("compares ordinary directories that merely contain lock-shaped metadata", async () => {
    const committed = makeRoot("lookalike-metadata-dir");
    const generated = makeRoot("lookalike-metadata-dir-generated");
    const lookalike = path.join(committed, "backup");
    fs.mkdirSync(lookalike);
    fs.writeFileSync(
      path.join(lookalike, "info.json"),
      JSON.stringify({
        pid: 4242,
        startedAt: "2026-05-17T12:00:00.000Z",
        inputFile: "",
        ownerToken: "lookalike",
      })
    );

    const comparison = await Effect.runPromise(
      compareOutputTrees({ committedRoot: committed, generatedRoot: generated })
    );

    expect(comparison.removed).toEqual(["backup/info.json"]);
  });
});

describe("output tree unsupported entry kinds", () => {
  test.runIf(process.platform !== "win32")(
    "rejects a FIFO as an unsupported entry",
    () => {
      const committed = makeRoot("fifo-committed");
      const generated = makeRoot("fifo-generated");
      execFileSync("mkfifo", [path.join(committed, "pipe")]);

      const exit = Effect.runSyncExit(
        compareOutputTrees({
          committedRoot: committed,
          generatedRoot: generated,
        })
      );
      const failure = extractTypedFailure(exit);

      expect(failure).toEqual(
        expect.objectContaining({
          _tag: "UnsupportedOutputEntryError",
          relativePath: "pipe",
          entryType: "other",
        })
      );
    }
  );
});

describe("output tree snapshot errors", () => {
  test("maps a destination mkdir failure to a typed snapshot error", () => {
    const source = makeRoot("snapshot-mkdir-source");
    const destination = makeRoot("snapshot-mkdir-destination");
    writeFile(source, "index.ts", "one\n");
    const cause = Object.assign(new Error("simulated EACCES"), {
      code: "EACCES",
      errno: -1,
      syscall: "mkdir",
    });
    vi.spyOn(fs, "mkdirSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(
      snapshotOutputTree({ sourceRoot: source, destinationRoot: destination })
    );

    expect(extractTypedFailure(exit)).toEqual(
      expect.objectContaining({ _tag: "OutputSnapshotError", cause })
    );
  });

  test("maps a source listing failure to a typed snapshot error", () => {
    const source = makeRoot("snapshot-readdir-source");
    const destination = makeRoot("snapshot-readdir-destination");
    const cause = Object.assign(new Error("simulated EACCES"), {
      code: "EACCES",
      errno: -1,
      syscall: "readdir",
    });
    vi.spyOn(fs, "readdirSync").mockImplementationOnce(() => {
      throw cause;
    });

    const exit = Effect.runSyncExit(
      snapshotOutputTree({ sourceRoot: source, destinationRoot: destination })
    );

    expect(extractTypedFailure(exit)).toEqual(
      expect.objectContaining({ _tag: "OutputSnapshotError", cause })
    );
  });
});
