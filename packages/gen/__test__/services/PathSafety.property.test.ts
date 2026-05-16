import path from "node:path";
import { Effect } from "effect";
import {
  array,
  assert,
  constant,
  oneof,
  property,
  stringMatching,
} from "fast-check";
import { describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../src/errors/UnsafeGeneratedPathError.js";
import { PathSafety } from "../../src/services/PathSafety.js";

const runValidate = (
  outputDir: string,
  requestedPath: string
):
  | { readonly ok: true; readonly fullPath: string }
  | { readonly ok: false } => {
  const program = PathSafety.validateGeneratedPath({
    outputDir,
    requestedPath,
  });
  const exit = Effect.runSyncExit(
    program.pipe(Effect.provide(PathSafety.Default))
  );
  if (exit._tag === "Success") {
    return { ok: true, fullPath: exit.value.fullPath };
  }
  return { ok: false };
};

/**
 * Path segment arbitrary that exercises traversal, current-directory, and
 * normal name forms. Empty strings are filtered out because they map to
 * the join trivially and add no signal.
 */
const segmentArb = oneof(
  constant(".."),
  constant("."),
  stringMatching(/^[a-zA-Z0-9_-]{1,8}$/)
);

const traversalPathArb = array(segmentArb, { minLength: 1, maxLength: 6 })
  .map(segments => segments.join("/"))
  .filter(p => p.length > 0);

/**
 * Generates a safe relative path (no `..`, no leading `/`, no trailing
 * separator, and not just `.`). Used to verify the normalization-stability
 * property.
 */
const safeRelativePathArb = array(stringMatching(/^[a-zA-Z0-9_-]{1,8}$/), {
  minLength: 1,
  maxLength: 5,
})
  .map(segments => segments.join("/"))
  .filter(p => p.length > 0 && p !== ".");

describe("PathSafety (properties)", () => {
  test("any path containing '..' segments is either rejected or resolves strictly inside outputDir", () => {
    assert(
      property(traversalPathArb, requested => {
        const outputDir = "/safe/output";
        const result = runValidate(outputDir, requested);

        if (!result.ok) {
          return;
        }

        const outputRoot = path.resolve(outputDir);
        const inside =
          result.fullPath !== outputRoot &&
          result.fullPath.startsWith(`${outputRoot}${path.sep}`);
        expect(inside).toBe(true);
      })
    );
  });

  test("validating a safe relative path twice yields the same fullPath", () => {
    assert(
      property(safeRelativePathArb, requested => {
        const outputDir = "/safe/output";
        const first = runValidate(outputDir, requested);
        const second = runValidate(outputDir, requested);

        if (!first.ok || !second.ok) {
          // Skip cases the validator legitimately rejects (e.g. shapes the
          // arbitrary occasionally produces that violate other rules).
          return;
        }

        expect(second.fullPath).toBe(first.fullPath);
      })
    );
  });

  test("absolute paths are always rejected with UnsafeGeneratedPathError", () => {
    assert(
      property(
        array(stringMatching(/^[a-zA-Z0-9_-]{1,8}$/), {
          minLength: 1,
          maxLength: 4,
        }).map(segments => `/${segments.join("/")}`),
        requested => {
          const program = PathSafety.validateGeneratedPath({
            outputDir: "/safe/output",
            requestedPath: requested,
          });
          const exit = Effect.runSyncExit(
            program.pipe(Effect.provide(PathSafety.Default))
          );

          expect(exit._tag).toBe("Failure");
          if (exit._tag === "Failure") {
            const failure = exit.cause;
            const message = String(failure);
            expect(message).toMatch(/UnsafeGeneratedPathError|Unsafe/);
          }
        }
      )
    );
  });

  test("the empty string is always rejected with UnsafeGeneratedPathError", () => {
    const program = PathSafety.validateGeneratedPath({
      outputDir: "/safe/output",
      requestedPath: "",
    });
    const exit = Effect.runSyncExit(
      program.pipe(Effect.provide(PathSafety.Default))
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const isExpected =
        exit.cause._tag === "Fail" &&
        exit.cause.error instanceof UnsafeGeneratedPathError;
      expect(isExpected).toBe(true);
    }
  });
});
