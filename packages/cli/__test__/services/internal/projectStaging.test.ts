import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { Cause, Deferred, Effect, Exit, FileSystem, Fiber } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ReservedCoordinationPathError,
  UnsafeStagingRootError,
} from "../../../src/errors/index.js";
import { canonicalHostTempDirectory } from "../../../src/services/internal/hostTemp.js";
import {
  assertStagingParentSafe,
  linkDirectory,
  linkNearestNodeModules,
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
  }).pipe(Effect.provide(nodeFileSystemLayer));

afterEach(() => {
  vi.restoreAllMocks();
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("directory staging links", () => {
  test("requests an elevation-free junction on Windows", async () => {
    const symlink = vi.spyOn(fs.promises, "symlink").mockResolvedValue();

    await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* linkDirectory(
          fileSystem,
          "C:\\project\\node_modules",
          "C:\\stage\\node_modules",
          "win32"
        );
      }).pipe(Effect.provide(nodeFileSystemLayer))
    );

    expect(symlink).toHaveBeenCalledWith(
      "C:\\project\\node_modules",
      "C:\\stage\\node_modules",
      "junction"
    );
  });
  test("maps Windows junction failures into the typed filesystem channel", async () => {
    const cause = Object.assign(new Error("junction denied"), {
      code: "EPERM",
      errno: -1,
      syscall: "symlink",
    });
    vi.spyOn(fs.promises, "symlink").mockRejectedValue(cause);

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* linkDirectory(
          fileSystem,
          "C:\\project\\node_modules",
          "C:\\stage\\node_modules",
          "win32"
        );
      }).pipe(Effect.provide(nodeFileSystemLayer))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toMatchObject({
          _tag: "PlatformError",
          reason: {
            _tag: "PermissionDenied",
            module: "FileSystem",
            method: "symlink",
            pathOrDescriptor: "C:\\stage\\node_modules",
          },
        });
      }
    }
  });
  test("removes a staged directory link without deleting its external target", async () => {
    const workspace = createTempDir("external-link-cleanup");
    const externalNodeModules = path.join(workspace, "external-node-modules");
    const sentinel = path.join(externalNodeModules, "sentinel.txt");
    fs.mkdirSync(externalNodeModules);
    fs.writeFileSync(sentinel, "preserve\n");
    let stagePath: string | undefined;

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          stagePath = yield* fileSystem.makeTempDirectoryScoped({
            prefix: "typeweaver-link-cleanup-",
          });
          yield* linkDirectory(
            fileSystem,
            externalNodeModules,
            path.join(stagePath, "node_modules")
          );
        })
      ).pipe(Effect.provide(nodeFileSystemLayer))
    );

    expect(stagePath).toBeDefined();
    expect(fs.existsSync(stagePath ?? "")).toBe(false);
    expect(fs.readFileSync(sentinel, "utf8")).toBe("preserve\n");
  });
});

describe("withStagedProject lifecycle", () => {
  test("removes the stage after success", async () => {
    const workspace = createTempDir("cleanup-success");
    let successStage: string | undefined;
    await Effect.runPromise(
      stagedProject(
        {
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
          prefix: "typeweaver-check-",
          forbiddenRoots: [workspace],
        },
        stagePath =>
          Effect.sync(() => {
            failureStage = stagePath;
          }).pipe(Effect.andThen(Effect.die(new Error("stage failure"))))
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
        const fiber = yield* Effect.forkChild(
          stagedProject(
            {
              prefix: "typeweaver-check-",
              forbiddenRoots: [workspace],
            },
            stagePath =>
              Deferred.succeed(entered, stagePath).pipe(
                Effect.andThen(Deferred.await(blocked))
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

    const stagePath = path.join(workspace, "stage");
    fs.mkdirSync(stagePath);
    await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* linkNearestNodeModules(fileSystem, project, stagePath);
      }).pipe(Effect.provide(nodeFileSystemLayer))
    );

    expect(fs.realpathSync(path.join(stagePath, "node_modules"))).toBe(
      fs.realpathSync(path.join(project, "node_modules"))
    );
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
          prefix: "typeweaver-check-",
          forbiddenRoots: [filesystemRoot],
        },
        () => Effect.void
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
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
    const reservedSource = path.join(
      canonicalHostTempDirectory(),
      `.typeweaver-output-lock-${"a".repeat(64)}`
    );

    const exit = await Effect.runPromiseExit(
      stagedProject(
        {
          prefix: "typeweaver-check-",
          forbiddenRoots: [reservedSource],
        },
        () => Effect.void
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(ReservedCoordinationPathError);
      }
    }
  });
});
