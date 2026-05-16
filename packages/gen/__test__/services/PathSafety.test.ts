import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect } from "vitest";
import { UnsafeGeneratedPathError } from "../../src/errors/UnsafeGeneratedPathError.js";
import { PathSafety } from "../../src/services/PathSafety.js";

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
});
