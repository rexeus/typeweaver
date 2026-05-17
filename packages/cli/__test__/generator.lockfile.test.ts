import fs from "node:fs";
import path from "node:path";
import { Cause, Exit } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { ConcurrentGenerationError } from "../src/errors/ConcurrentGenerationError.js";
import { Generator } from "../src/services/Generator.js";

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
    JSON.stringify({ ...info, inputFile: "" }, null, 2)
  );
  return lockDir;
};

const extractFailure = (exit: Exit.Exit<void, unknown>): unknown => {
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected generation to fail with the held lock");
  }
  const failure = Cause.failureOption(exit.cause);
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure; got: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};

describe("Generator output lock", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

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
        holderPid: process.pid,
        holderStartedAt: heldStartedAt,
      })
    );
  });

  test("reclaims a stale lock left behind by a crashed run with a dead PID", async () => {
    const workspace = createTempWorkspace("stale");
    writeTinySpec(workspace);

    // PID 99_999_999 is well above the Linux default max-pid (~32k) and
    // Darwin/Windows equivalents — guaranteed not to exist.
    const staleStartedAt = "2026-05-17T11:00:00.000Z";
    seedHeldLock(workspace, { pid: 99_999_999, startedAt: staleStartedAt });

    await expect(runGenerate(workspace)).resolves.toBeUndefined();

    const lockDir = path.join(
      workspace,
      "generated",
      "output",
      ".typeweaver-lock"
    );
    expect(fs.existsSync(lockDir)).toBe(false);
    // Generation actually produced output despite the stale lock.
    expect(
      fs.existsSync(
        path.join(workspace, "generated", "output", "item", "GetItemRequest.ts")
      )
    ).toBe(true);
  });

  test("formats the user-facing message with the holder PID and start time", () => {
    const error = new ConcurrentGenerationError({
      outputDir: "/tmp/typeweaver-out",
      holderPid: 4242,
      holderStartedAt: "2026-05-17T08:00:00.000Z",
    });

    expect(error.message).toContain("/tmp/typeweaver-out");
    expect(error.message).toContain("PID 4242");
    expect(error.message).toContain("2026-05-17T08:00:00.000Z");
    expect(error.message).toContain(".typeweaver-lock");
  });
});
