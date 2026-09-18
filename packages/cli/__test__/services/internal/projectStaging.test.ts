import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import {
  ReservedCoordinationPathError,
  UnsafeStagingRootError,
} from "../../../src/errors/index.js";
import { canonicalHostTempDirectory } from "../../../src/services/internal/hostTemp.js";
import {
  assertStagingParentSafe,
  withStagedProject,
} from "../../../src/services/internal/projectStaging.js";
import type { StagedProjectParams } from "../../../src/services/internal/projectStaging.js";

const tempDirs: string[] = [];

const createTempDir = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-staging-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const stagedProject = <A>(
  params: StagedProjectParams,
  use: (stagePath: string) => Effect.Effect<A>
) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    return yield* withStagedProject(fileSystem, params, use);
  }).pipe(Effect.provide(NodeContext.layer));

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("withStagedProject lifecycle", () => {
  test("removes the stage after success", async () => {
    const workspace = createTempDir("cleanup-success");
    let successStage: string | undefined;
    await Effect.runPromise(
      stagedProject(
        {
          dependencyDirectory: workspace,
          prefix: "typeweaver-check-",
          forbiddenRoots: [workspace],
        },
        stagePath =>
          Effect.sync(() => {
            successStage = stagePath;
          })
      )
    );
    expect(successStage).toBeDefined();
    expect(path.dirname(successStage ?? "")).toBe(canonicalHostTempDirectory());
    expect(fs.existsSync(successStage ?? "")).toBe(false);
  });

  test("removes the stage after a defect", async () => {
    const workspace = createTempDir("cleanup-defect");
    let failureStage: string | undefined;
    const exit = await Effect.runPromiseExit(
      stagedProject(
        {
          dependencyDirectory: workspace,
          prefix: "typeweaver-check-",
          forbiddenRoots: [workspace],
        },
        stagePath =>
          Effect.sync(() => {
            failureStage = stagePath;
          }).pipe(Effect.zipRight(Effect.die(new Error("stage failure"))))
      )
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(failureStage).toBeDefined();
    expect(fs.existsSync(failureStage ?? "")).toBe(false);
  });

  test("removes the stage on interruption", async () => {
    const workspace = createTempDir("interrupt");
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const entered = yield* Deferred.make<string>();
        const blocked = yield* Deferred.make<void>();
        const fiber = yield* Effect.fork(
          stagedProject(
            {
              dependencyDirectory: workspace,
              prefix: "typeweaver-check-",
              forbiddenRoots: [workspace],
            },
            stagePath =>
              Deferred.succeed(entered, stagePath).pipe(
                Effect.zipRight(Deferred.await(blocked))
              )
          )
        );
        const stagePath = yield* Deferred.await(entered);
        yield* Fiber.interrupt(fiber);
        return stagePath;
      })
    );

    expect(fs.existsSync(result)).toBe(false);
  });

  test("links node_modules from the dependency directory", async () => {
    const workspace = createTempDir("dependency");
    const project = path.join(workspace, "packages", "api");
    fs.mkdirSync(path.join(project, "node_modules"), { recursive: true });

    const linked = await Effect.runPromise(
      stagedProject(
        {
          dependencyDirectory: project,
          prefix: "typeweaver-check-",
          forbiddenRoots: [workspace, project],
        },
        stagePath =>
          Effect.sync(() => fs.existsSync(path.join(stagePath, "node_modules")))
      )
    );

    expect(linked).toBe(true);
  });
});

describe("staging parent safety", () => {
  test("rejects a parent that a forbidden root contains", async () => {
    const workspace = createTempDir("overlap");
    const configuredOutput = path.join(workspace, "generated");
    const filesystemRoot = path.parse(canonicalHostTempDirectory()).root;

    const exit = await Effect.runPromiseExit(
      stagedProject(
        {
          dependencyDirectory: workspace,
          prefix: "typeweaver-check-",
          forbiddenRoots: [filesystemRoot],
        },
        () => Effect.void
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(UnsafeStagingRootError);
      }
    }
    expect(fs.existsSync(configuredOutput)).toBe(false);
  });

  test("allows an ordinary project path under the temp root", () => {
    const workspace = createTempDir("ordinary");
    expect(() =>
      assertStagingParentSafe(canonicalHostTempDirectory(), [workspace])
    ).not.toThrow();
  });

  test("rejects a staging parent equal to a forbidden root", () => {
    const workspace = createTempDir("equal");
    expect(() => assertStagingParentSafe(workspace, [workspace])).toThrow(
      UnsafeStagingRootError
    );
  });

  test("rejects a forbidden root in the reserved coordination namespace", async () => {
    const workspace = createTempDir("reserved");
    const reservedSource = path.join(
      canonicalHostTempDirectory(),
      `.typeweaver-output-lock-${"a".repeat(64)}`
    );

    const exit = await Effect.runPromiseExit(
      stagedProject(
        {
          dependencyDirectory: workspace,
          prefix: "typeweaver-check-",
          forbiddenRoots: [reservedSource],
        },
        () => Effect.void
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(ReservedCoordinationPathError);
      }
    }
  });
});
