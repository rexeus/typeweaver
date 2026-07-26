import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { SystemError } from "@effect/platform/Error";
import { Cause, Effect, Either, Layer } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { ProjectInitializer } from "../src/services/ProjectInitializer.js";

const templateDir = path.resolve(
  import.meta.dirname,
  "../src/templates/project-init"
);
const workspaces: string[] = [];

const createWorkspace = (): string => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-init-rollback-")
  );
  workspaces.push(workspace);
  return workspace;
};

const failingPublishLayer = (
  targetDir: string
): Layer.Layer<FileSystem.FileSystem> => {
  let publishCount = 0;
  return Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const base = yield* FileSystem.FileSystem;
      return FileSystem.makeNoop({
        ...base,
        rename: (source, destination) => {
          const publishesStagedFile =
            source.includes(`${path.sep}new${path.sep}`) &&
            destination.startsWith(`${targetDir}${path.sep}`);
          if (publishesStagedFile) {
            publishCount += 1;
          }
          if (publishesStagedFile && publishCount === 3) {
            return Effect.fail(
              new SystemError({
                reason: "PermissionDenied",
                module: "FileSystem",
                method: "rename",
                pathOrDescriptor: destination,
                description: "injected publication failure",
              })
            );
          }
          return base.rename(source, destination);
        },
      });
    })
  ).pipe(Layer.provide(NodeFileSystem.layer));
};

afterEach(() => {
  for (const workspace of workspaces) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  workspaces.length = 0;
});

describe("ProjectInitializer rollback", () => {
  test("restores every target file when publication fails", async () => {
    const workspace = createWorkspace();
    const targetDir = path.join(workspace, "existing");
    const originalReadme = "existing readme\n";
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, "README.md"), originalReadme);
    fs.writeFileSync(path.join(targetDir, "sentinel.txt"), "keep\n");

    const initializerLayer = ProjectInitializer.Default.pipe(
      Layer.provide(failingPublishLayer(targetDir))
    );
    const result = await Effect.runPromise(
      ProjectInitializer.initialize({
        targetDir,
        currentWorkingDirectory: workspace,
        templateDir,
        typeweaverVersion: "0.12.0",
        zodVersion: "^4.4.3",
        force: true,
        dryRun: false,
      }).pipe(Effect.either, Effect.provide(initializerLayer))
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(Cause.originalError(result.left)).toMatchObject({
        _tag: "ProjectInitFileSystemError",
        operation: "rename",
      });
    }
    expect(fs.readFileSync(path.join(targetDir, "README.md"), "utf8")).toBe(
      originalReadme
    );
    expect(fs.readFileSync(path.join(targetDir, "sentinel.txt"), "utf8")).toBe(
      "keep\n"
    );
    expect(fs.readdirSync(targetDir).sort()).toEqual([
      "README.md",
      "sentinel.txt",
    ]);
    expect(
      fs
        .readdirSync(workspace)
        .some(entry => entry.startsWith(".typeweaver-init-"))
    ).toBe(false);
  });
});
