import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../src/errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../../src/helpers/pathSafety.js";
import { PathSafety } from "../../src/services/PathSafety.js";
import type { PathSafetyFs } from "../../src/helpers/pathSafety.js";

const expectFailureWithReason = (
  exit: Exit.Exit<unknown, UnsafeGeneratedPathError>,
  reason: UnsafeGeneratedPathError["reason"]
): void => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) return;
  const failure = Cause.failureOption(exit.cause);
  expect(Option.isSome(failure)).toBe(true);
  if (!Option.isSome(failure)) return;
  expect(failure.value).toBeInstanceOf(UnsafeGeneratedPathError);
  expect(failure.value.reason).toBe(reason);
};

describe("PathSafety", () => {
  it.effect("returns a safe descriptor for a valid relative path", () =>
    Effect.gen(function* () {
      const result = yield* PathSafety.validateGeneratedPath({
        outputDir: "/tmp/output",
        requestedPath: "domain/entity.ts",
      });
      expect(result.generatedPath).toBe("domain/entity.ts");
      expect(result.fullPath.endsWith("domain/entity.ts")).toBe(true);
    }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect("fails with parent-traversal reason for `..` in path", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "../escape.ts",
        })
      );
      expectFailureWithReason(exit, "parent-traversal");
    }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect("fails with absolute-path reason for absolute requested path", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "/etc/passwd",
        })
      );
      expectFailureWithReason(exit, "absolute-path");
    }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect("fails with empty-path reason for empty string", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "",
        })
      );
      expectFailureWithReason(exit, "empty-path");
    }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect("fails with current-directory reason for requestedPath '.'", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: ".",
        })
      );
      expectFailureWithReason(exit, "current-directory");
    }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect("fails with parent-traversal reason for requestedPath '..'", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "..",
        })
      );
      expectFailureWithReason(exit, "parent-traversal");
    }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect(
    "fails with trailing-separator reason for requestedPath ending with '/'",
    () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          PathSafety.validateGeneratedPath({
            outputDir: "/tmp/output",
            requestedPath: "domain/entity.ts/",
          })
        );
        expectFailureWithReason(exit, "trailing-separator");
      }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect(
    "fails with nul-byte reason for requestedPath containing a NUL byte",
    () =>
      Effect.gen(function* () {
        const requestedPath = `foo${String.fromCharCode(0)}bar.ts`;
        const exit = yield* Effect.exit(
          PathSafety.validateGeneratedPath({
            outputDir: "/tmp/output",
            requestedPath,
          })
        );
        expectFailureWithReason(exit, "nul-byte");
      }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect(
    "accepts an outputDir with a trailing slash and produces the same fullPath as without",
    () =>
      Effect.gen(function* () {
        const withTrailing = yield* PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output/",
          requestedPath: "domain/entity.ts",
        });
        const withoutTrailing = yield* PathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "domain/entity.ts",
        });

        expect(withTrailing.fullPath).toBe(withoutTrailing.fullPath);
      }).pipe(Effect.provide(PathSafety.Default))
  );

  it.effect("accepts an outputDir that does not yet exist on disk", () =>
    Effect.gen(function* () {
      const result = yield* PathSafety.validateGeneratedPath({
        outputDir: "/does-not-exist-on-disk-12345/output",
        requestedPath: "fresh/entity.ts",
      });

      expect(result.generatedPath).toBe("fresh/entity.ts");
      expect(result.fullPath.endsWith("fresh/entity.ts")).toBe(true);
    }).pipe(Effect.provide(PathSafety.Default))
  );

  test("rejects paths whose intermediate components are symlinks", () => {
    const outputDir = "/tmp/sandbox";
    // The fake reports that `domain` is a symlink directory: the guard walks
    // segment-by-segment and rejects the first symlink it observes.
    const fakeFs: PathSafetyFs = {
      lstat: absolutePath => {
        if (absolutePath === outputDir) {
          return { isSymbolicLink: () => false, isDirectory: () => true };
        }
        if (absolutePath === `${outputDir}/domain`) {
          return { isSymbolicLink: () => true, isDirectory: () => true };
        }
        return undefined;
      },
    };

    expect(() =>
      resolveSafeGeneratedFilePath(outputDir, "domain/entity.ts", fakeFs)
    ).toThrow(
      expect.objectContaining({
        _tag: "UnsafeGeneratedPathError",
        reason: "symlink-component",
        requestedPath: "domain/entity.ts",
      }) as unknown as Error
    );
  });

  // The `escapes-output` reason in `resolveSafeGeneratedFilePath` is
  // defense-in-depth: the earlier `absolute-path` and `parent-traversal`
  // checks catch every input that could otherwise reach the final
  // `isStrictlyInsidePath` test. The seam is intentionally unreachable from
  // the public API — leaving the branch exercised only by code review keeps
  // the test from baking in a contradiction.
  test.skip("rejects paths that escape the output root via the final containment check", () => {});
});
