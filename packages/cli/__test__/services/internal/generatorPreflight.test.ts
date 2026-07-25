import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { afterEach, describe, expect } from "vitest";
import {
  prepareGeneration,
  resolveGenerationPaths,
  withGenerationLock,
} from "../../../src/services/internal/generatorPreflight.js";

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
  ).pipe(Effect.provide(NodeContext.layer));

describe("generator preflight and lock workflow", () => {
  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

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
      }).pipe(Effect.provide(NodeContext.layer));
    }
  );

  it.effect(
    "holds the lock for the workflow, releases it after failure, and permits retry",
    () => {
      const workspace = makeWorkspace();
      const workflowFailure = new Error("intentional workflow failure");

      return Effect.gen(function* () {
        const plan = yield* makePlan(workspace);
        const lockPath = path.join(plan.outputDir, ".typeweaver-lock");

        const firstExit = yield* Effect.exit(
          withGenerationLock(
            plan,
            Effect.sync(() => {
              expect(fs.existsSync(lockPath)).toBe(true);
              throw workflowFailure;
            })
          )
        );

        expect(Exit.isFailure(firstExit)).toBe(true);
        if (Exit.isFailure(firstExit)) {
          expect(Array.from(Cause.defects(firstExit.cause))).toEqual([
            workflowFailure,
          ]);
        }
        expect(fs.existsSync(lockPath)).toBe(false);

        yield* withGenerationLock(
          plan,
          Effect.sync(() => {
            expect(fs.existsSync(lockPath)).toBe(true);
          })
        );
        expect(fs.existsSync(lockPath)).toBe(false);
      }).pipe(Effect.provide(NodeContext.layer));
    }
  );

  it.effect("releases the lock after interruption", () => {
    const workspace = makeWorkspace();

    return Effect.gen(function* () {
      const plan = yield* makePlan(workspace);
      const lockPath = path.join(plan.outputDir, ".typeweaver-lock");
      const entered = yield* Deferred.make<void>();
      const blocked = yield* Deferred.make<void>();
      const fiber = yield* Effect.fork(
        withGenerationLock(
          plan,
          Deferred.succeed(entered, undefined).pipe(
            Effect.zipRight(Deferred.await(blocked))
          )
        )
      );

      yield* Deferred.await(entered);
      expect(fs.existsSync(lockPath)).toBe(true);
      const exit = yield* Fiber.interrupt(fiber);

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.isInterruptedOnly(exit.cause)).toBe(true);
      }
      expect(fs.existsSync(lockPath)).toBe(false);
    }).pipe(Effect.provide(NodeContext.layer));
  });
});
