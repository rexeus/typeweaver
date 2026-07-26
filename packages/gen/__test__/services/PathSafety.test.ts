import path from "node:path";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, test } from "vitest";
import { GeneratedPathProbeError } from "../../src/errors/GeneratedPathProbeError.js";
import { UnsafeGeneratedPathError } from "../../src/errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../../src/helpers/pathSafety.js";
import { makePathSafety, PathSafety } from "../../src/services/PathSafety.js";
import type { PathSafetyFs } from "../../src/helpers/pathSafety.js";

const expectFailureWithReason = (
  exit: Exit.Exit<unknown, GeneratedPathProbeError | UnsafeGeneratedPathError>,
  reason: UnsafeGeneratedPathError["reason"]
): void => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) return;
  const failure = Cause.failureOption(exit.cause);
  expect(Option.isSome(failure)).toBe(true);
  if (!Option.isSome(failure)) return;
  expect(failure.value).toBeInstanceOf(UnsafeGeneratedPathError);
  if (!(failure.value instanceof UnsafeGeneratedPathError)) return;
  expect(failure.value.reason).toBe(reason);
};

const accessDeniedError = (): NodeJS.ErrnoException =>
  Object.assign(new Error("permission denied"), {
    code: "EACCES",
    errno: -13,
    syscall: "lstat",
  });

describe("PathSafety relative path validation", () => {
  it.effect("returns a safe descriptor for a valid relative path", () =>
    Effect.gen(function* () {
      const result = yield* PathSafety.validateGeneratedPath({
        outputDir: "/tmp/output",
        requestedPath: "domain/entity.ts",
      });
      expect(result.generatedPath).toBe("domain/entity.ts");
      expect(result.fullPath).toBe(
        path.resolve("/tmp/output", "domain/entity.ts")
      );
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
});

describe("PathSafety path normalization", () => {
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
      expect(result.fullPath).toBe(
        path.resolve("/does-not-exist-on-disk-12345/output", "fresh/entity.ts")
      );
    }).pipe(Effect.provide(PathSafety.Default))
  );
});

describe("PathSafety probe failures", () => {
  it.effect(
    "exposes EACCES path probes as GeneratedPathProbeError without defects",
    () => {
      const cause = accessDeniedError();
      const pathSafety = makePathSafety({
        lstat: () => {
          throw cause;
        },
      });

      return Effect.gen(function* () {
        const exit = yield* Effect.exit(
          pathSafety.validateGeneratedPath({
            outputDir: "/tmp/output",
            requestedPath: "domain/entity.ts",
          })
        );

        expect(Exit.isFailure(exit)).toBe(true);
        if (!Exit.isFailure(exit)) return;

        expect(Array.from(Cause.defects(exit.cause))).toEqual([]);

        const failure = Cause.failureOption(exit.cause);
        expect(Option.isSome(failure)).toBe(true);
        if (!Option.isSome(failure)) return;

        expect(failure.value).toBeInstanceOf(GeneratedPathProbeError);
        if (!(failure.value instanceof GeneratedPathProbeError)) return;

        expect(failure.value).toMatchObject({
          _tag: "GeneratedPathProbeError",
          operation: "lstat",
          requestedPath: "domain/entity.ts",
          probedPath: path.resolve("/tmp/output"),
          code: "EACCES",
          cause,
        });
      });
    }
  );

  it.effect("keeps non-system path-probe throws as defects", () => {
    const bug = new TypeError("broken path-safety adapter");
    const pathSafety = makePathSafety({
      lstat: () => {
        throw bug;
      },
    });

    return Effect.gen(function* () {
      const exit = yield* Effect.exit(
        pathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "domain/entity.ts",
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (!Exit.isFailure(exit)) return;

      expect(Option.isNone(Cause.failureOption(exit.cause))).toBe(true);
      expect(Array.from(Cause.defects(exit.cause))).toEqual([bug]);
    });
  });

  it.effect("keeps coded programming errors as defects", () => {
    const bug = Object.assign(new TypeError("invalid path argument"), {
      code: "ERR_INVALID_ARG_TYPE",
    });
    const pathSafety = makePathSafety({
      lstat: () => {
        throw bug;
      },
    });

    return Effect.gen(function* () {
      const exit = yield* Effect.exit(
        pathSafety.validateGeneratedPath({
          outputDir: "/tmp/output",
          requestedPath: "domain/entity.ts",
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (!Exit.isFailure(exit)) return;

      expect(Option.isNone(Cause.failureOption(exit.cause))).toBe(true);
      expect(Array.from(Cause.defects(exit.cause))).toEqual([bug]);
    });
  });
});

describe("PathSafety symlink protection", () => {
  test("rejects paths whose intermediate components are symlinks", () => {
    const outputDir = path.resolve("/tmp/sandbox");
    // The fake reports that `domain` is a symlink directory: the guard walks
    // segment-by-segment and rejects the first symlink it observes.
    const fakeFs: PathSafetyFs = {
      lstat: absolutePath => {
        if (absolutePath === outputDir) {
          return { isSymbolicLink: () => false, isDirectory: () => true };
        }
        if (absolutePath === path.join(outputDir, "domain")) {
          return { isSymbolicLink: () => true, isDirectory: () => true };
        }
        return undefined;
      },
    };

    let caughtError: unknown;
    try {
      resolveSafeGeneratedFilePath(outputDir, "domain/entity.ts", fakeFs);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(UnsafeGeneratedPathError);
    if (!(caughtError instanceof UnsafeGeneratedPathError)) return;
    expect(caughtError.reason).toBe("symlink-component");
    expect(caughtError.requestedPath).toBe("domain/entity.ts");
  });
});
