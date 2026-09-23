import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TYPEWEAVER_COORDINATION_MARKER_FILE } from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

import {
  compareOutputTrees,
  snapshotOutputTree,
} from "../../../src/services/outputComparison.js";

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
  const failure = Cause.findErrorOption(exit.cause);
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
      expect(Array.from(causeDefects(exit.cause))).toEqual([]);
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
