import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import {
  prepareGeneration,
  resolveGenerationPaths,
  withGenerationLock,
} from "../../../src/services/internal/generatorPreflight.js";
import { outputLockDirectory } from "../../../src/services/internal/outputCoordinationArtifact.js";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

const tempDirs: string[] = [];

const makeWorkspace = (): string => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-preflight-")
  );
  tempDirs.push(workspace);
  return workspace;
};

const makePlan = (workspace: string) =>
  prepareGeneration(
    resolveGenerationPaths({
      inputFile: "spec/index.ts",
      outputDir: "generated/output",
      config: {
        input: "spec/index.ts",
        output: "generated/output",
        clean: false,
      },
      currentWorkingDirectory: workspace,
    })
  ).pipe(Effect.provide(nodeFileSystemLayer));

const expectLockHeld = (lockPath: string) =>
  Effect.sync(() => {
    expect(fs.existsSync(lockPath)).toBe(true);
  });

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("generator preflight and lock workflow", () => {
  it.effect(
    "rejects an unsafe target before creating generator subdirectories",
    () => {
      const workspace = makeWorkspace();
      const exit = Effect.exit(
        prepareGeneration(
          resolveGenerationPaths({
            inputFile: "spec/index.ts",
            outputDir: ".",
            currentWorkingDirectory: workspace,
          })
        )
      );

      return Effect.gen(function* () {
        const result = yield* exit;
        expect(Exit.isFailure(result)).toBe(true);
        expect(fs.existsSync(path.join(workspace, "responses"))).toBe(false);
        expect(fs.existsSync(path.join(workspace, "spec"))).toBe(false);
      }).pipe(Effect.provide(nodeFileSystemLayer));
    }
  );

  it.effect(
    "holds the lock for the workflow, releases it after failure, and permits retry",
    () => {
      const workspace = makeWorkspace();
      const workflowFailure = new Error("intentional workflow failure");

      return Effect.gen(function* () {
        const plan = yield* makePlan(workspace);
        const lockPath = outputLockDirectory(plan.outputDir);

        const firstExit = yield* Effect.exit(
          withGenerationLock(plan, () =>
            expectLockHeld(lockPath).pipe(
              Effect.andThen(Effect.die(workflowFailure))
            )
          )
        );

        expect(Exit.isFailure(firstExit)).toBe(true);
        if (Exit.isFailure(firstExit)) {
          expect(Array.from(causeDefects(firstExit.cause))).toEqual([
            workflowFailure,
          ]);
        }
        expect(fs.existsSync(lockPath)).toBe(false);

        yield* withGenerationLock(plan, () => expectLockHeld(lockPath));
        expect(fs.existsSync(lockPath)).toBe(false);
      }).pipe(Effect.provide(nodeFileSystemLayer));
    }
  );

  it.effect("releases the lock after interruption", () => {
    const workspace = makeWorkspace();

    return Effect.gen(function* () {
      const plan = yield* makePlan(workspace);
      const lockPath = outputLockDirectory(plan.outputDir);
      const entered = yield* Deferred.make<void>();
      const blocked = yield* Deferred.make<void>();
      const fiber = yield* Effect.forkChild(
        withGenerationLock(plan, () =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Deferred.await(blocked))
          )
        )
      );

      yield* Deferred.await(entered);
      expect(fs.existsSync(lockPath)).toBe(true);
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
      }
      expect(fs.existsSync(lockPath)).toBe(false);
    }).pipe(Effect.provide(nodeFileSystemLayer));
  });
});

describe("generator canonical lock binding", () => {
  test("keeps output writes bound to the canonical path acquired by the lock", async () => {
    const workspace = makeWorkspace();
    const firstTarget = path.join(workspace, "first-target");
    const secondTarget = path.join(workspace, "second-target");
    const alias = path.join(workspace, "output-alias");
    fs.mkdirSync(firstTarget);
    fs.mkdirSync(secondTarget);
    fs.symlinkSync(
      firstTarget,
      alias,
      process.platform === "win32" ? "junction" : "dir"
    );
    const plan = await Effect.runPromise(
      prepareGeneration(
        resolveGenerationPaths({
          inputFile: "spec/index.ts",
          outputDir: "output-alias/generated",
          config: {
            input: "spec/index.ts",
            output: "output-alias/generated",
            clean: false,
          },
          currentWorkingDirectory: workspace,
        })
      ).pipe(Effect.provide(nodeFileSystemLayer))
    );

    await Effect.runPromise(
      withGenerationLock(plan, lockedPlan =>
        Effect.sync(() => {
          fs.unlinkSync(alias);
          fs.symlinkSync(
            secondTarget,
            alias,
            process.platform === "win32" ? "junction" : "dir"
          );
          fs.writeFileSync(
            path.join(lockedPlan.outputDir, "marker.txt"),
            "locked\n"
          );
        })
      ).pipe(Effect.provide(nodeFileSystemLayer))
    );

    expect(
      fs.readFileSync(path.join(firstTarget, "generated", "marker.txt"), "utf8")
    ).toBe("locked\n");
    expect(fs.existsSync(path.join(secondTarget, "generated"))).toBe(false);
  });
});
