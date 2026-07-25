import path from "node:path";
import { Cause, Effect, Exit, Option } from "effect";
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
import type { GeneratedPathProbeError } from "../../src/errors/GeneratedPathProbeError.js";
import type { PathSafetyFs } from "../../src/helpers/pathSafety.js";

const runValidate = (
  outputDir: string,
  requestedPath: string
): Exit.Exit<
  {
    readonly fullPath: string;
    readonly generatedPath: string;
  },
  GeneratedPathProbeError | UnsafeGeneratedPathError
> => {
  const program = PathSafety.validateGeneratedPath({
    outputDir,
    requestedPath,
  });
  return Effect.runSyncExit(program.pipe(Effect.provide(PathSafety.Default)));
};

const expectUnsafeFailure = (
  exit: Exit.Exit<unknown, GeneratedPathProbeError | UnsafeGeneratedPathError>,
  expected: {
    readonly requestedPath: string;
    readonly reason: UnsafeGeneratedPathError["reason"];
  }
): void => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) return;

  const failure = Cause.failureOption(exit.cause);
  expect(Option.isSome(failure)).toBe(true);
  if (!Option.isSome(failure)) return;

  expect(failure.value).toBeInstanceOf(UnsafeGeneratedPathError);
  if (!(failure.value instanceof UnsafeGeneratedPathError)) return;

  expect(failure.value).toMatchObject(expected);
};

const safeSegmentArb = stringMatching(/^[a-zA-Z0-9_-]{1,8}$/);

const safeRelativePathArb = array(safeSegmentArb, {
  minLength: 1,
  maxLength: 5,
}).map(segments => segments.join("/"));

const traversalPathArb = tuple(
  array(safeSegmentArb, { maxLength: 3 }),
  array(safeSegmentArb, { maxLength: 3 })
).map(([before, after]) => [...before, "..", ...after].join("/"));

describe("PathSafety (properties)", () => {
  test("every path containing a parent segment fails with its exact typed reason", () => {
    assert(
      property(traversalPathArb, requested => {
        const exit = runValidate("/safe/output", requested);

        expectUnsafeFailure(exit, {
          requestedPath: requested,
          reason: "parent-traversal",
        });
      })
    );
  });

  test("every safe relative path preserves its generated path and resolves exactly inside outputDir", () => {
    assert(
      property(safeRelativePathArb, requested => {
        const outputDir = "/safe/output";
        const exit = runValidate(outputDir, requested);

        expect(Exit.isSuccess(exit)).toBe(true);
        if (!Exit.isSuccess(exit)) return;

        expect(exit.value).toEqual({
          generatedPath: requested,
          fullPath: path.resolve(outputDir, requested),
        });
      })
    );
  });
});

/**
 * Every generated input is absolute according to Windows path semantics:
 * drive-rooted, current-drive-rooted, or UNC-rooted.
 */
const windowsSegmentArb = stringMatching(/^[a-zA-Z0-9_-]{1,8}$/);
const windowsPathTailArb = array(windowsSegmentArb, {
  minLength: 1,
  maxLength: 4,
}).map(segments => segments.join("\\"));
const windowsAbsolutePathArb = oneof(
  tuple(constantFrom("C", "c", "Z"), windowsPathTailArb).map(
    ([drive, tail]) => `${drive}:\\${tail}`
  ),
  windowsPathTailArb.map(tail => `\\${tail}`),
  tuple(windowsSegmentArb, windowsSegmentArb, windowsPathTailArb).map(
    ([server, share, tail]) => `\\\\${server}\\${share}\\${tail}`
  )
);

describe("PathSafety (properties, Windows-flavoured inputs)", () => {
  test("every absolute Windows path fails with the exact absolute-path reason", () => {
    assert(
      property(windowsAbsolutePathArb, requested => {
        const exit = runValidate("/safe/output", requested);

        expectUnsafeFailure(exit, {
          requestedPath: requested,
          reason: "absolute-path",
        });
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
        const outputDir = path.resolve("safe", "output");
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

        let caught: UnsafeGeneratedPathError | undefined;
        try {
          resolveSafeGeneratedFilePath(outputDir, requestedPath, fakeFs);
        } catch (error) {
          if (error instanceof UnsafeGeneratedPathError) {
            caught = error;
          } else {
            throw error;
          }
        }

        expect(caught).toMatchObject({
          requestedPath,
          reason: "symlink-component",
        });
      })
    );
  });
});
