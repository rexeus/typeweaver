import { FileSystem } from "@effect/platform";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect } from "vitest";
import { GeneratedPathProbeError } from "../../../src/errors/GeneratedPathProbeError.js";
import { makeEffectContextIO } from "../../../src/services/internal/pluginContextEffectIO.js";

const makeThrowingContextIO = (error: unknown) =>
  makeEffectContextIO({
    fileSystem: FileSystem.makeNoop({}),
    pathSafety: {
      validateGeneratedPath: () => {
        throw error;
      },
    },
    templateRenderer: {
      render: () => "",
    },
    outputDir: "/tmp/output",
    templateDir: "/tmp/templates",
    trackWrite: () => undefined,
    trackGenerated: () => undefined,
  });

describe("makeEffectContextIO", () => {
  it.effect(
    "keeps EACCES path-probe failures in the typed channel without defects",
    () => {
      const cause = Object.assign(new Error("permission denied"), {
        code: "EACCES",
      });
      const probeError = new GeneratedPathProbeError({
        operation: "lstat",
        requestedPath: "domain/entity.ts",
        probedPath: "/tmp/output",
        code: cause.code,
        cause,
      });
      const contextIO = makeThrowingContextIO(probeError);

      return Effect.gen(function* () {
        const exit = yield* Effect.exit(
          contextIO.addGeneratedFileEffect("domain/entity.ts")
        );

        expect(Exit.isFailure(exit)).toBe(true);
        if (!Exit.isFailure(exit)) return;

        expect(Array.from(Cause.defects(exit.cause))).toEqual([]);

        const failure = Cause.failureOption(exit.cause);
        expect(Option.isSome(failure)).toBe(true);
        if (!Option.isSome(failure)) return;

        expect(failure.value).toBe(probeError);
        if (!(failure.value instanceof GeneratedPathProbeError)) return;
        expect(failure.value.code).toBe("EACCES");
      });
    }
  );

  it.effect("keeps non-system path-safety throws as defects", () => {
    const bug = new TypeError("broken path-safety adapter");
    const contextIO = makeThrowingContextIO(bug);

    return Effect.gen(function* () {
      const exit = yield* Effect.exit(
        contextIO.addGeneratedFileEffect("domain/entity.ts")
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (!Exit.isFailure(exit)) return;

      expect(Option.isNone(Cause.failureOption(exit.cause))).toBe(true);
      expect(Array.from(Cause.defects(exit.cause))).toEqual([bug]);
    });
  });
});
