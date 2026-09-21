import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  coordinationArtifactMarkerSource,
  TYPEWEAVER_COORDINATION_MARKER_FILE,
} from "@rexeus/typeweaver-gen";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

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
      expect(Array.from(causeDefects(exit.cause))).toEqual([]);
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
