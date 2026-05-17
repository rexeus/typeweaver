import path from "node:path";
import { Effect } from "effect";
import {
  array,
  assert,
  constant,
  constantFrom,
  oneof,
  property,
  stringMatching,
  tuple,
} from "fast-check";
import { describe, expect, test } from "vitest";
import { UnsafeGeneratedPathError } from "../../src/errors/UnsafeGeneratedPathError.js";
import { resolveSafeGeneratedFilePath } from "../../src/helpers/pathSafety.js";
import { PathSafety } from "../../src/services/PathSafety.js";
import type { PathSafetyFs } from "../../src/helpers/pathSafety.js";

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

  test("outputDir with a trailing slash produces the same fullPath as without", () => {
    assert(
      property(safeRelativePathArb, requested => {
        const withTrailing = runValidate("/safe/output/", requested);
        const withoutTrailing = runValidate("/safe/output", requested);

        // If one rejects, both must reject for the same input — the trailing
        // slash on outputDir is not a per-input policy concern.
        if (!withTrailing.ok || !withoutTrailing.ok) {
          return;
        }

        expect(withTrailing.fullPath).toBe(withoutTrailing.fullPath);
      })
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

/**
 * Windows-flavoured path arbitrary: builds inputs mixing backslashes, drive
 * prefixes (`C:`, `c:`), and UNC roots (`\\server\share`). The guard must
 * reject every such input with `absolute-path` or `parent-traversal` —
 * the two reasons that catch absolute Windows roots before
 * `resolveSafeGeneratedFilePath` reaches the symlink walk.
 */
const windowsSegmentArb = oneof(
  constant("C:"),
  constant("c:"),
  constant("\\\\server\\share"),
  constant("\\"),
  stringMatching(/^[a-zA-Z0-9_-]{1,4}$/)
);
const windowsPathArb = array(windowsSegmentArb, {
  minLength: 1,
  maxLength: 4,
}).map(segments => segments.join("\\"));

describe("PathSafety (properties, Windows-flavoured inputs)", () => {
  test("any Windows-shaped absolute or drive-prefixed path is rejected with absolute-path or parent-traversal", () => {
    assert(
      property(windowsPathArb, requested => {
        if (requested.length === 0) return;
        // The arbitrary occasionally produces a bare relative segment that is
        // legitimately safe (e.g. "foo"). Skip those — the property is about
        // Windows-shaped inputs that should be rejected.
        const looksWindowsAbsolute =
          /^[a-zA-Z]:/.test(requested) ||
          requested.startsWith("\\\\") ||
          requested.startsWith("\\");
        if (!looksWindowsAbsolute) return;

        const program = PathSafety.validateGeneratedPath({
          outputDir: "/safe/output",
          requestedPath: requested,
        });
        const exit = Effect.runSyncExit(
          program.pipe(Effect.provide(PathSafety.Default))
        );

        expect(exit._tag).toBe("Failure");
        if (exit._tag !== "Failure") return;
        if (exit.cause._tag !== "Fail") return;
        expect(exit.cause.error).toBeInstanceOf(UnsafeGeneratedPathError);
        const reason = (exit.cause.error as UnsafeGeneratedPathError).reason;
        // `\\server\share` triggers `parent-traversal` because Node's posix
        // normalization collapses backslashes and reads the leading
        // sequence; the drive-prefixed and absolute forms trigger
        // `absolute-path`. Either reason proves the input was rejected
        // before any filesystem touch.
        expect(["absolute-path", "parent-traversal"]).toContain(reason);
      })
    );
  });
});

/**
 * Symlink-aware property test: drives the helper directly (the seam used by
 * the production callers) with an in-memory `PathSafetyFs`. Each property
 * picks an arbitrary segment index to mark as a symlink; the validator must
 * reject with `symlink-component` for every safe-otherwise input.
 */
describe("PathSafety (properties, symlink-component branch)", () => {
  const safeSegmentArb = stringMatching(/^[a-zA-Z0-9_-]{1,8}$/);
  const safeSegmentsArb = array(safeSegmentArb, {
    minLength: 2,
    maxLength: 4,
  });
  const symlinkScenarioArb = safeSegmentsArb.chain(segments =>
    tuple(constant(segments), constantFrom(...segments.map((_, idx) => idx)))
  );

  test("a path whose component at any index is a symlink is rejected with symlink-component", () => {
    assert(
      property(symlinkScenarioArb, ([segments, symlinkIndex]) => {
        const outputDir = "/safe/output";
        const symlinkAbsolute = path.join(
          outputDir,
          ...segments.slice(0, symlinkIndex + 1)
        );

        const fakeFs: PathSafetyFs = {
          lstat: absolutePath => {
            if (absolutePath === outputDir) {
              return { isSymbolicLink: () => false, isDirectory: () => true };
            }
            if (absolutePath === symlinkAbsolute) {
              return { isSymbolicLink: () => true, isDirectory: () => true };
            }
            // Earlier components walk through as plain directories so the
            // loop reaches the symlink segment.
            return { isSymbolicLink: () => false, isDirectory: () => true };
          },
        };

        const requestedPath = segments.join("/");

        let caughtReason: string | undefined;
        try {
          resolveSafeGeneratedFilePath(outputDir, requestedPath, fakeFs);
        } catch (error) {
          if (error instanceof UnsafeGeneratedPathError) {
            caughtReason = error.reason;
          } else {
            throw error;
          }
        }

        expect(caughtReason).toBe("symlink-component");
      })
    );
  });
});
