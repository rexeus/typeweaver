import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { makeInMemoryFileSystem } from "test-utils/src/effect/index.js";
import type { PlatformError } from "@effect/platform/Error";

type FileSystemHarness = {
  readonly layer: Layer.Layer<FileSystem.FileSystem>;
  readonly root: string;
  readonly join: (...segments: readonly string[]) => string;
  readonly cleanup: () => void;
};

type FileSystemVariant = {
  readonly name: string;
  readonly createHarness: () => FileSystemHarness;
};

const variants: readonly FileSystemVariant[] = [
  {
    name: "InMemoryFileSystem",
    createHarness: () => {
      const { layer } = makeInMemoryFileSystem();
      return {
        layer,
        root: "/contract",
        join: path.posix.join,
        cleanup: () => undefined,
      };
    },
  },
  {
    name: "NodeFileSystem",
    createHarness: () => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "typeweaver-fs-contract-")
      );
      return {
        layer: NodeFileSystem.layer,
        root,
        join: path.join,
        cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
      };
    },
  },
];

const withHarness = <A, E>(
  variant: FileSystemVariant,
  use: (
    harness: FileSystemHarness
  ) => Effect.Effect<A, E, FileSystem.FileSystem>
): Effect.Effect<A, E> =>
  Effect.acquireUseRelease(
    Effect.sync(variant.createHarness),
    harness => use(harness).pipe(Effect.provide(harness.layer)),
    harness => Effect.sync(harness.cleanup)
  );

const assertNotFoundWithoutDefects = (
  exit: Exit.Exit<unknown, PlatformError>
): void => {
  assert.isTrue(Exit.isFailure(exit));
  if (Exit.isSuccess(exit)) {
    return;
  }

  assert.deepStrictEqual(Array.from(Cause.defects(exit.cause)), []);
  const failure = Cause.failureOption(exit.cause);
  assert.isTrue(Option.isSome(failure));
  if (Option.isNone(failure)) {
    return;
  }

  assert.strictEqual(failure.value._tag, "SystemError");
  if (failure.value._tag === "SystemError") {
    assert.strictEqual(failure.value.module, "FileSystem");
    assert.strictEqual(failure.value.reason, "NotFound");
  }
};

describe.each(variants)("$name contract", variant => {
  it.effect(
    "supports the generated-file lifecycle through observable filesystem state",
    () =>
      withHarness(variant, harness =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const directory = harness.join(harness.root, "generated");
          const source = harness.join(directory, "source.ts");
          const destination = harness.join(directory, "destination.ts");

          yield* fileSystem.makeDirectory(directory, { recursive: true });
          yield* fileSystem.writeFileString(
            source,
            "export const value = 1;\n"
          );

          assert.deepStrictEqual(yield* fileSystem.readDirectory(directory), [
            "source.ts",
          ]);
          assert.strictEqual(
            yield* fileSystem.readFileString(source),
            "export const value = 1;\n"
          );
          assert.strictEqual((yield* fileSystem.stat(source)).type, "File");

          yield* fileSystem.rename(source, destination);
          assert.isFalse(yield* fileSystem.exists(source));
          assert.isTrue(yield* fileSystem.exists(destination));

          yield* fileSystem.remove(harness.root, {
            recursive: true,
            force: true,
          });
          assert.isFalse(yield* fileSystem.exists(harness.root));
        })
      )
  );

  it.effect("fails a missing read as typed NotFound without defects", () =>
    withHarness(variant, harness =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory(harness.root, { recursive: true });

        const exit = yield* Effect.exit(
          fileSystem.readFileString(harness.join(harness.root, "missing.ts"))
        );

        assertNotFoundWithoutDefects(exit);
      })
    )
  );

  it.effect(
    "fails a write below a missing parent as typed NotFound without defects",
    () =>
      withHarness(variant, harness =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          yield* fileSystem.makeDirectory(harness.root, { recursive: true });

          const exit = yield* Effect.exit(
            fileSystem.writeFileString(
              harness.join(harness.root, "missing", "output.ts"),
              "export {};\n"
            )
          );

          assertNotFoundWithoutDefects(exit);
        })
      )
  );

  it.effect(
    "fails non-recursive directory creation below a missing parent as typed NotFound without defects",
    () =>
      withHarness(variant, harness =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          yield* fileSystem.makeDirectory(harness.root, { recursive: true });

          const exit = yield* Effect.exit(
            fileSystem.makeDirectory(
              harness.join(harness.root, "missing", "child")
            )
          );

          assertNotFoundWithoutDefects(exit);
        })
      )
  );

  it.effect(
    "fails a rename below a missing destination parent as typed NotFound without defects",
    () =>
      withHarness(variant, harness =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const source = harness.join(harness.root, "source.ts");
          yield* fileSystem.makeDirectory(harness.root, { recursive: true });
          yield* fileSystem.writeFileString(source, "export {};\n");

          const exit = yield* Effect.exit(
            fileSystem.rename(
              source,
              harness.join(harness.root, "missing", "destination.ts")
            )
          );

          assertNotFoundWithoutDefects(exit);
        })
      )
  );

  it.effect(
    "fails realPath on a missing path as typed NotFound without defects",
    () =>
      withHarness(variant, harness =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          yield* fileSystem.makeDirectory(harness.root, { recursive: true });

          const exit = yield* Effect.exit(
            fileSystem.realPath(harness.join(harness.root, "missing"))
          );

          assertNotFoundWithoutDefects(exit);
        })
      )
  );

  it.effect("removes a scoped temporary directory when its scope closes", () =>
    withHarness(variant, harness =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory(harness.root, { recursive: true });

        const scopedPaths = yield* Effect.scoped(
          Effect.gen(function* () {
            const tempDirectory = yield* fileSystem.makeTempDirectoryScoped({
              directory: harness.root,
              prefix: ".typeweaver-contract-",
            });
            const tempFile = harness.join(tempDirectory, "output.ts");
            yield* fileSystem.writeFileString(tempFile, "export {};\n");
            assert.isTrue(yield* fileSystem.exists(tempDirectory));
            assert.isTrue(yield* fileSystem.exists(tempFile));
            return { tempDirectory, tempFile };
          })
        );

        assert.isFalse(yield* fileSystem.exists(scopedPaths.tempDirectory));
        assert.isFalse(yield* fileSystem.exists(scopedPaths.tempFile));
      })
    )
  );

  it.effect(
    "fails scoped temporary directory creation below a missing base as typed NotFound without defects",
    () =>
      withHarness(variant, harness =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          yield* fileSystem.makeDirectory(harness.root, { recursive: true });

          const exit = yield* Effect.exit(
            Effect.scoped(
              fileSystem.makeTempDirectoryScoped({
                directory: harness.join(harness.root, "missing"),
              })
            )
          );

          assertNotFoundWithoutDefects(exit);
        })
      )
  );
});
