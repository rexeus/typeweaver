import fs from "node:fs";
import path from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { ConcurrentGenerationError } from "../src/errors/ConcurrentGenerationError.js";
import { Generator } from "../src/services/Generator.js";
import {
  acquireOutputLock,
  acquireOutputLockWith,
  releaseOutputLock,
} from "../src/services/generatorIO.js";
import type { OutputLock } from "../src/services/generatorIO.js";

const tempDirs: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-lockfile-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpec = (workspace: string): string => {
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
  return specFile;
};

const runGenerate = (workspace: string): Promise<void> =>
  effectRuntime.runPromise(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
      },
      currentWorkingDirectory: workspace,
    })
  );

const runGenerateExit = (
  workspace: string
): Promise<Exit.Exit<void, unknown>> =>
  effectRuntime.runPromiseExit(
    Generator.generate({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        format: false,
      },
      currentWorkingDirectory: workspace,
    })
  );

const seedHeldLock = (
  workspace: string,
  info: { readonly pid: number; readonly startedAt: string }
): string => {
  const outputDir = path.join(workspace, "generated", "output");
  const lockDir = path.join(outputDir, ".typeweaver-lock");
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(
    path.join(lockDir, "info.json"),
    JSON.stringify(
      { ...info, inputFile: "", ownerToken: `seed-${info.pid}` },
      null,
      2
    )
  );
  return lockDir;
};

const mockProcessLookupError = (pid: number, code: string) =>
  vi.spyOn(process, "kill").mockImplementation(candidatePid => {
    if (candidatePid === pid) {
      throw Object.assign(new Error(`process lookup failed with ${code}`), {
        code,
      });
    }
    return true;
  });

const extractFailure = <A>(exit: Exit.Exit<A, unknown>): unknown => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected generation to fail with the held lock");
  }
  const failure = Cause.failureOption(exit.cause);
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure; got: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("Generator failed output-lock release recovery", () => {
  test("reclaims its abandoned live-PID lock after a transient metadata read failure", async () => {
    const workspace = createTempWorkspace("release-probe-retry");
    const outputDir = path.join(workspace, "generated", "output");
    const inputFile = path.join(workspace, "spec", "index.ts");
    fs.mkdirSync(outputDir, { recursive: true });
    const lock = Effect.runSync(acquireOutputLock({ outputDir, inputFile }));
    const lockInfoPath = path.join(lock.path, "info.json");
    const releaseFailure = Object.assign(
      new Error("simulated transient lock metadata read failure"),
      {
        code: "EACCES",
        errno: -1,
        syscall: "read",
      }
    );
    const readFileSync = fs.readFileSync;
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementation((target, options) => {
        if (target === lockInfoPath) {
          throw releaseFailure;
        }
        return readFileSync(target, options);
      });

    try {
      await Effect.runPromise(releaseOutputLock(lock));
    } finally {
      readFileSyncSpy.mockRestore();
    }

    const replacement = await Effect.runPromise(
      acquireOutputLock({ outputDir, inputFile })
    );

    expect(replacement.ownerToken).not.toBe(lock.ownerToken);
    await Effect.runPromise(releaseOutputLock(replacement));
  });

  test("reclaims its abandoned live-PID lock after a transient detach failure", async () => {
    const workspace = createTempWorkspace("release-retry");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    const releaseFailure = Object.assign(
      new Error("simulated transient lock release failure"),
      {
        code: "EPERM",
        errno: -1,
        syscall: "rename",
      }
    );
    let releaseFailureCount = 0;
    const renameSync = fs.renameSync;
    const renameSyncSpy = vi
      .spyOn(fs, "renameSync")
      .mockImplementation((target, options) => {
        if (target === lockDir && releaseFailureCount === 0) {
          releaseFailureCount += 1;
          throw releaseFailure;
        }
        renameSync(target, options);
      });

    try {
      await expect(runGenerate(workspace)).resolves.toBeUndefined();
    } finally {
      renameSyncSpy.mockRestore();
    }

    expect(releaseFailureCount).toBe(1);
    expect(fs.existsSync(lockDir)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDir, "info.json"), "utf8"))
    ).toEqual(
      expect.objectContaining({
        pid: process.pid,
        ownerToken: expect.any(String),
      })
    );

    // The same ManagedRuntime remains alive. Once the transient filesystem
    // failure is gone, its next run must fence only the exact abandoned token,
    // acquire a fresh lock, and complete normally.
    await expect(runGenerate(workspace)).resolves.toBeUndefined();

    expect(fs.existsSync(lockDir)).toBe(false);
    expect(
      fs
        .readdirSync(outputDir)
        .filter(entry => entry.startsWith(".typeweaver-lock.fence-"))
    ).toHaveLength(1);
  });
});

describe("Generator detached output-lock cleanup", () => {
  test("keeps the canonical lock free when fence cleanup partially fails", async () => {
    const workspace = createTempWorkspace("fence-cleanup-failure");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    const cleanupFailure = Object.assign(
      new Error("simulated partial fence cleanup failure"),
      {
        code: "EPERM",
        errno: -1,
        syscall: "rm",
      }
    );
    const removeSync = fs.rmSync;
    let failedFencePath: string | undefined;
    const removeSyncSpy = vi
      .spyOn(fs, "rmSync")
      .mockImplementation((target, options) => {
        if (
          typeof target === "string" &&
          path.dirname(target) === outputDir &&
          path.basename(target).startsWith(".typeweaver-lock.fence-") &&
          failedFencePath === undefined
        ) {
          failedFencePath = target;
          removeSync(path.join(target, "info.json"), { force: true });
          throw cleanupFailure;
        }
        removeSync(target, options);
      });

    try {
      await expect(runGenerate(workspace)).resolves.toBeUndefined();
    } finally {
      removeSyncSpy.mockRestore();
    }

    expect(failedFencePath).toBeDefined();
    expect(fs.existsSync(lockDir)).toBe(false);
    if (failedFencePath === undefined) {
      throw new Error("Expected the detached fence cleanup to fail");
    }
    expect(fs.existsSync(failedFencePath)).toBe(true);
    expect(fs.existsSync(path.join(failedFencePath, "info.json"))).toBe(false);

    await expect(runGenerate(workspace)).resolves.toBeUndefined();
    expect(fs.existsSync(lockDir)).toBe(false);
  });
});

describe("Generator output-lock ownership", () => {
  test("releases the lock after a successful run so a follow-up run can re-acquire it", async () => {
    const workspace = createTempWorkspace("happy");
    writeTinySpec(workspace);

    await runGenerate(workspace);
    const lockDir = path.join(
      workspace,
      "generated",
      "output",
      ".typeweaver-lock"
    );
    expect(fs.existsSync(lockDir)).toBe(false);

    // Second run on the same workspace must succeed; lock was released
    // and the next acquire sees no contention.
    await expect(runGenerate(workspace)).resolves.toBeUndefined();
    expect(fs.existsSync(lockDir)).toBe(false);
  });

  test("rejects a second run with ConcurrentGenerationError when a live PID holds the lock", async () => {
    const workspace = createTempWorkspace("collision");
    writeTinySpec(workspace);

    const heldStartedAt = "2026-05-17T12:00:00.000Z";
    seedHeldLock(workspace, { pid: process.pid, startedAt: heldStartedAt });

    const exit = await runGenerateExit(workspace);
    const failure = extractFailure(exit);

    expect(failure).toBeInstanceOf(ConcurrentGenerationError);
    expect(failure).toEqual(
      expect.objectContaining({
        _tag: "ConcurrentGenerationError",
        outputDir: path.join(workspace, "generated", "output"),
        holder: {
          _tag: "Known",
          pid: process.pid,
          startedAt: heldStartedAt,
        },
      })
    );
  });

  test("reclaims a stale lock left behind by a crashed run with a dead PID", async () => {
    const workspace = createTempWorkspace("stale");
    writeTinySpec(workspace);

    const deadPid = 99_999_999;
    const staleStartedAt = "2026-05-17T11:00:00.000Z";
    seedHeldLock(workspace, { pid: deadPid, startedAt: staleStartedAt });
    const processLookup = mockProcessLookupError(deadPid, "ESRCH");

    try {
      await expect(runGenerate(workspace)).resolves.toBeUndefined();
    } finally {
      processLookup.mockRestore();
    }

    const outputDir = path.join(workspace, "generated", "output");
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    expect(fs.existsSync(lockDir)).toBe(false);
    expect(
      fs
        .readdirSync(outputDir)
        .filter(entry => entry.startsWith(".typeweaver-lock.fence-"))
    ).toHaveLength(1);
    // Generation actually produced output despite the stale lock.
    expect(
      fs.existsSync(
        path.join(workspace, "generated", "output", "item", "GetItemRequest.ts")
      )
    ).toBe(true);
  });

  test("does not reclaim a lock when process liveness fails with an unknown platform error", async () => {
    const workspace = createTempWorkspace("liveness-error");
    writeTinySpec(workspace);
    const holderPid = 424_242;
    const lockDir = seedHeldLock(workspace, {
      pid: holderPid,
      startedAt: "2026-05-17T11:30:00.000Z",
    });
    const processLookup = mockProcessLookupError(holderPid, "EIO");

    try {
      const exit = await runGenerateExit(workspace);
      expect(extractFailure(exit)).toBeInstanceOf(ConcurrentGenerationError);
    } finally {
      processLookup.mockRestore();
    }

    expect(fs.existsSync(lockDir)).toBe(true);
  });
});

describe("Generator output-lock metadata", () => {
  test("does not reclaim a lock whose ownership metadata is not yet published", async () => {
    const workspace = createTempWorkspace("acquiring");
    const outputDir = path.join(workspace, "generated", "output");
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    fs.mkdirSync(lockDir, { recursive: true });

    const exit = await Effect.runPromiseExit(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(workspace, "spec", "index.ts"),
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure).toEqual(
        expect.objectContaining({
          value: expect.objectContaining({
            _tag: "ConcurrentGenerationError",
            holder: { _tag: "Unknown" },
          }),
        })
      );
    }
    expect(fs.existsSync(lockDir)).toBe(true);
    expect(fs.existsSync(path.join(lockDir, "info.json"))).toBe(false);
  });

  test("does not reclaim a lock with partially written ownership metadata", async () => {
    const workspace = createTempWorkspace("partial-metadata");
    const outputDir = path.join(workspace, "generated", "output");
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(path.join(lockDir, "info.json"), '{"pid":');

    const exit = await Effect.runPromiseExit(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(workspace, "spec", "index.ts"),
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(fs.existsSync(lockDir)).toBe(true);
    expect(fs.readFileSync(path.join(lockDir, "info.json"), "utf8")).toBe(
      '{"pid":'
    );
  });
});

describe("Generator output-lock acquisition rollback", () => {
  test("rolls back its lock directory when metadata publication fails", async () => {
    const workspace = createTempWorkspace("publication-failure");
    const outputDir = path.join(workspace, "generated", "output");
    fs.mkdirSync(outputDir, { recursive: true });
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    const writeFileSync = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementationOnce(() => {
        throw new Error("simulated metadata write failure");
      });

    const exit = await Effect.runPromiseExit(
      acquireOutputLock({
        outputDir,
        inputFile: path.join(workspace, "spec", "index.ts"),
      })
    );

    writeFileSync.mockRestore();
    expect(Exit.isFailure(exit)).toBe(true);
    expect(fs.existsSync(lockDir)).toBe(false);
  });

  test("does not roll back a replacement owner's lock after acquisition fails", async () => {
    const workspace = createTempWorkspace("rollback-replacement");
    const outputDir = path.join(workspace, "generated", "output");
    const inputFile = path.join(workspace, "spec", "index.ts");
    const lockDir = path.join(outputDir, ".typeweaver-lock");
    fs.mkdirSync(outputDir, { recursive: true });

    const exit = Effect.runSyncExit(
      acquireOutputLockWith(
        { outputDir, inputFile },
        {
          onLockDirectoryCreated: createdLockDir => {
            fs.rmSync(createdLockDir, { recursive: true, force: true });
            fs.mkdirSync(createdLockDir);
            fs.writeFileSync(
              path.join(createdLockDir, "info.json"),
              JSON.stringify({
                pid: process.pid,
                startedAt: "2026-05-17T12:30:00.000Z",
                inputFile,
                ownerToken: "replacement-during-acquisition",
              })
            );
            throw new Error("simulated acquisition failure");
          },
          onBeforeStaleLockMove: () => undefined,
        }
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(fs.existsSync(lockDir)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(lockDir, "info.json"), "utf8"))
    ).toEqual(
      expect.objectContaining({
        ownerToken: "replacement-during-acquisition",
      })
    );
  });
});

describe("Generator output-lock acquisition races", () => {
  test("allows exactly one winner while ownership metadata is being published", async () => {
    const workspace = createTempWorkspace("publication-race");
    const outputDir = path.join(workspace, "generated", "output");
    const inputFile = path.join(workspace, "spec", "index.ts");
    fs.mkdirSync(outputDir, { recursive: true });
    let contenderSucceeded = false;

    const winner = Effect.runSync(
      acquireOutputLockWith(
        { outputDir, inputFile },
        {
          onLockDirectoryCreated: () => {
            const contender = Effect.runSyncExit(
              acquireOutputLock({ outputDir, inputFile })
            );
            contenderSucceeded = Exit.isSuccess(contender);
          },
          onBeforeStaleLockMove: () => undefined,
        }
      )
    );

    expect(contenderSucceeded).toBe(false);
    expect(fs.existsSync(path.join(winner.path, "info.json"))).toBe(true);
    await Effect.runPromise(releaseOutputLock(winner));
  });
});

describe("Generator failed-release ownership isolation", () => {
  test("does not reclaim a replacement live-PID owner after an old release failed", async () => {
    const workspace = createTempWorkspace("failed-release-replacement");
    const outputDir = path.join(workspace, "generated", "output");
    const inputFile = path.join(workspace, "spec", "index.ts");
    fs.mkdirSync(outputDir, { recursive: true });
    const original = Effect.runSync(
      acquireOutputLock({ outputDir, inputFile })
    );
    const releaseFailure = Object.assign(
      new Error("simulated transient lock release failure"),
      {
        code: "EPERM",
        errno: -1,
        syscall: "rename",
      }
    );
    const renameSync = fs.renameSync;
    const renameSyncSpy = vi
      .spyOn(fs, "renameSync")
      .mockImplementation((target, options) => {
        if (target === original.path) {
          throw releaseFailure;
        }
        renameSync(target, options);
      });

    try {
      await Effect.runPromise(releaseOutputLock(original));
    } finally {
      renameSyncSpy.mockRestore();
    }

    fs.rmSync(original.path, { recursive: true, force: true });
    fs.mkdirSync(original.path);
    const replacementToken = "replacement-after-failed-release";
    fs.writeFileSync(
      path.join(original.path, "info.json"),
      JSON.stringify({
        pid: process.pid,
        startedAt: "2026-05-17T12:50:00.000Z",
        inputFile,
        ownerToken: replacementToken,
      })
    );

    const contender = await Effect.runPromiseExit(
      acquireOutputLock({ outputDir, inputFile })
    );

    expect(Exit.isFailure(contender)).toBe(true);
    expect(extractFailure(contender)).toBeInstanceOf(ConcurrentGenerationError);
    expect(
      JSON.parse(fs.readFileSync(path.join(original.path, "info.json"), "utf8"))
    ).toEqual(expect.objectContaining({ ownerToken: replacementToken }));

    // Clear the abandoned-token marker through the ownership-changed release
    // path without removing the replacement owner's lock.
    await Effect.runPromise(releaseOutputLock(original));
  });
});

describe("Generator output-lock replacement races", () => {
  test("does not remove a replacement lock when stale reclaimers interleave", async () => {
    const workspace = createTempWorkspace("stale-reclaim-race");
    const outputDir = path.join(workspace, "generated", "output");
    const inputFile = path.join(workspace, "spec", "index.ts");
    fs.mkdirSync(outputDir, { recursive: true });
    const deadPid = 99_999_999;
    seedHeldLock(workspace, {
      pid: deadPid,
      startedAt: "2026-05-17T12:45:00.000Z",
    });
    let replacement: OutputLock | undefined;
    const processLookup = mockProcessLookupError(deadPid, "ESRCH");

    let staleContender: Exit.Exit<OutputLock, unknown>;
    try {
      staleContender = Effect.runSyncExit(
        acquireOutputLockWith(
          { outputDir, inputFile },
          {
            onLockDirectoryCreated: () => undefined,
            onBeforeStaleLockMove: () => {
              replacement = Effect.runSync(
                acquireOutputLock({ outputDir, inputFile })
              );
            },
          }
        )
      );
    } finally {
      processLookup.mockRestore();
    }

    expect(Exit.isFailure(staleContender)).toBe(true);
    expect(replacement).toBeDefined();
    if (replacement === undefined) {
      throw new Error("Expected the interleaved contender to acquire the lock");
    }
    expect(fs.existsSync(replacement.path)).toBe(true);
    const replacementInfo = JSON.parse(
      fs.readFileSync(path.join(replacement.path, "info.json"), "utf8")
    );
    expect(replacementInfo).toEqual(
      expect.objectContaining({ ownerToken: replacement.ownerToken })
    );
    await Effect.runPromise(releaseOutputLock(replacement));
  });

  test("does not release a lock now owned by a replacement process", async () => {
    const workspace = createTempWorkspace("replacement-owner");
    const outputDir = path.join(workspace, "generated", "output");
    const inputFile = path.join(workspace, "spec", "index.ts");
    fs.mkdirSync(outputDir, { recursive: true });
    const original = Effect.runSync(
      acquireOutputLock({ outputDir, inputFile })
    );

    fs.rmSync(original.path, { recursive: true, force: true });
    fs.mkdirSync(original.path);
    fs.writeFileSync(
      path.join(original.path, "info.json"),
      JSON.stringify({
        pid: process.pid,
        startedAt: "2026-05-17T13:00:00.000Z",
        inputFile,
        ownerToken: "replacement-owner",
      })
    );

    await Effect.runPromise(releaseOutputLock(original));

    expect(fs.existsSync(original.path)).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(original.path, "info.json"), "utf8"))
    ).toEqual(expect.objectContaining({ ownerToken: "replacement-owner" }));
  });
});

describe("Generator output-lock diagnostics", () => {
  test("formats the user-facing message with the holder PID and start time", () => {
    const error = new ConcurrentGenerationError({
      outputDir: "/tmp/typeweaver-out",
      holder: {
        _tag: "Known",
        pid: 4242,
        startedAt: "2026-05-17T08:00:00.000Z",
      },
    });

    expect(error.message).toContain("/tmp/typeweaver-out");
    expect(error.message).toContain("PID 4242");
    expect(error.message).toContain("2026-05-17T08:00:00.000Z");
    expect(error.message).toContain(".typeweaver-lock");
  });
});
