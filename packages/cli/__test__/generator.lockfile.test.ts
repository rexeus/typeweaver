import fs from "node:fs";
import path from "node:path";
import { Cause, Effect, Exit } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { ConcurrentGenerationError } from "../src/errors/ConcurrentGenerationError.js";
import { Generator } from "../src/services/Generator.js";
import {
  acquireOutputLock,
  releaseOutputLock,
} from "../src/services/generatorIO.js";
import { outputLockDirectory } from "../src/services/internal/outputCoordinationArtifact.js";

const tempDirs: string[] = [];

const fencePrefixFor = (lockDir: string): string =>
  `${path.basename(lockDir)}.fence-`;

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
      '  metadata: { title: "Items API", version: "1.0.0" },',
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
  const lockDir = outputLockDirectory(outputDir);
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
  const failure = Cause.findErrorOption(exit.cause);
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
    const lockDir = outputLockDirectory(outputDir);
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
        ownerToken: expect.any(String) as unknown,
      }) as unknown
    );

    // The same ManagedRuntime remains alive. Once the transient filesystem
    // failure is gone, its next run must fence only the exact abandoned token,
    // acquire a fresh lock, and complete normally.
    await expect(runGenerate(workspace)).resolves.toBeUndefined();

    expect(fs.existsSync(lockDir)).toBe(false);
    expect(
      fs
        .readdirSync(path.dirname(lockDir))
        .filter(entry => entry.startsWith(fencePrefixFor(lockDir)))
    ).toHaveLength(1);
  });
});

describe("Generator detached output-lock cleanup", () => {
  test("keeps the canonical lock free when fence cleanup partially fails", async () => {
    const workspace = createTempWorkspace("fence-cleanup-failure");
    writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated", "output");
    const lockDir = outputLockDirectory(outputDir);
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
          path.dirname(target) === path.dirname(lockDir) &&
          path.basename(target).startsWith(fencePrefixFor(lockDir)) &&
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
    const lockDir = outputLockDirectory(
      path.join(workspace, "generated", "output")
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
      }) as unknown
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
    const lockDir = outputLockDirectory(outputDir);
    expect(fs.existsSync(lockDir)).toBe(false);
    expect(
      fs
        .readdirSync(path.dirname(lockDir))
        .filter(entry => entry.startsWith(fencePrefixFor(lockDir)))
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
