import { FileSystem } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Option, Ref } from "effect";
import { describe, expect } from "vitest";
import { GeneratedPathProbeError } from "../../../src/errors/GeneratedPathProbeError.js";
import { makeEffectContextIO } from "../../../src/services/internal/pluginContextEffectIO.js";

const outputDir = "/project/generated";
const generatedPath = "todo/GetTodoClient.ts";
const destinationPath = `${outputDir}/${generatedPath}`;
const tempDir = `${outputDir}/todo/.typeweaver-test`;
const tempFile = `${tempDir}/generated.tmp`;

const missingTarget = new SystemError({
  reason: "NotFound",
  module: "FileSystem",
  method: "stat",
  pathOrDescriptor: destinationPath,
});

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

const makeAtomicContextIO = (config: {
  readonly rename: (
    oldPath: string,
    newPath: string
  ) => Effect.Effect<void, never>;
  readonly tempExists: Ref.Ref<boolean>;
  readonly cleanupCount: Ref.Ref<number>;
  readonly trackedWrites: string[];
}) =>
  makeEffectContextIO({
    fileSystem: FileSystem.makeNoop({
      stat: () => Effect.fail(missingTarget),
      makeDirectory: () => Effect.void,
      makeTempDirectoryScoped: () =>
        Effect.acquireRelease(
          Ref.set(config.tempExists, true).pipe(Effect.as(tempDir)),
          () =>
            Ref.set(config.tempExists, false).pipe(
              Effect.zipRight(
                Ref.update(config.cleanupCount, count => count + 1)
              )
            )
        ),
      writeFileString: (filePath, content) =>
        filePath === tempFile && content.length > 0
          ? Effect.void
          : Effect.die(
              new Error("Atomic-writer test received an unexpected temp write")
            ),
      rename: config.rename,
    }),
    pathSafety: {
      validateGeneratedPath: ({ requestedPath }) => ({
        fullPath: `${outputDir}/${requestedPath}`,
        generatedPath: requestedPath,
      }),
    },
    templateRenderer: {
      render: () => "",
    },
    outputDir,
    templateDir: "/project/templates",
    trackWrite: path => config.trackedWrites.push(path),
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

  it.effect(
    "commits rename and tracking before observing an interrupt already pending at rename",
    () =>
      Effect.gen(function* () {
        const renameEntered = yield* Deferred.make<void>();
        const allowRename = yield* Deferred.make<void>();
        const renameAttempts = yield* Ref.make(0);
        const destination = yield* Ref.make<string | undefined>(undefined);
        const tempExists = yield* Ref.make(false);
        const cleanupCount = yield* Ref.make(0);
        const trackedWrites: string[] = [];
        const contextIO = makeAtomicContextIO({
          tempExists,
          cleanupCount,
          trackedWrites,
          rename: (_oldPath, newPath) =>
            Ref.getAndUpdate(renameAttempts, count => count + 1).pipe(
              Effect.flatMap(attempt =>
                attempt === 0
                  ? Deferred.succeed(renameEntered, undefined).pipe(
                      Effect.zipRight(Deferred.await(allowRename)),
                      Effect.zipRight(Ref.set(destination, newPath))
                    )
                  : Ref.set(destination, newPath)
              )
            ),
        });

        const writer = yield* Effect.fork(
          contextIO.writeFileEffect(generatedPath, "generated")
        );
        yield* Deferred.await(renameEntered);
        yield* Fiber.interruptFork(writer);
        yield* Effect.yieldNow();
        yield* Deferred.succeed(allowRename, undefined);
        const exit = yield* Fiber.await(writer);

        expect(Exit.isFailure(exit)).toBe(true);
        if (!Exit.isFailure(exit)) return;
        expect(Cause.isInterruptedOnly(exit.cause)).toBe(true);
        expect(yield* Ref.get(destination)).toBe(destinationPath);
        expect(trackedWrites).toEqual([generatedPath]);
        expect(yield* Ref.get(tempExists)).toBe(false);
        expect(yield* Ref.get(cleanupCount)).toBe(1);

        yield* contextIO.writeFileEffect(generatedPath, "retry");

        expect(yield* Ref.get(destination)).toBe(destinationPath);
        expect(trackedWrites).toEqual([generatedPath, generatedPath]);
        expect(yield* Ref.get(tempExists)).toBe(false);
        expect(yield* Ref.get(cleanupCount)).toBe(2);
      })
  );

  it.effect(
    "cleans temp state after a rename defect and lets the same context retry",
    () =>
      Effect.gen(function* () {
        const renameDefect = new Error("rename adapter defect");
        const renameAttempts = yield* Ref.make(0);
        const destination = yield* Ref.make<string | undefined>(undefined);
        const tempExists = yield* Ref.make(false);
        const cleanupCount = yield* Ref.make(0);
        const trackedWrites: string[] = [];
        const contextIO = makeAtomicContextIO({
          tempExists,
          cleanupCount,
          trackedWrites,
          rename: (_oldPath, newPath) =>
            Ref.getAndUpdate(renameAttempts, count => count + 1).pipe(
              Effect.flatMap(attempt =>
                attempt === 0
                  ? Effect.die(renameDefect)
                  : Ref.set(destination, newPath)
              )
            ),
        });

        const firstExit = yield* Effect.exit(
          contextIO.writeFileEffect(generatedPath, "first")
        );

        expect(Exit.isFailure(firstExit)).toBe(true);
        if (!Exit.isFailure(firstExit)) return;
        expect(Array.from(Cause.defects(firstExit.cause))).toEqual([
          renameDefect,
        ]);
        expect(yield* Ref.get(destination)).toBeUndefined();
        expect(trackedWrites).toEqual([]);
        expect(yield* Ref.get(tempExists)).toBe(false);
        expect(yield* Ref.get(cleanupCount)).toBe(1);

        yield* contextIO.writeFileEffect(generatedPath, "retry");

        expect(yield* Ref.get(destination)).toBe(destinationPath);
        expect(trackedWrites).toEqual([generatedPath]);
        expect(yield* Ref.get(tempExists)).toBe(false);
        expect(yield* Ref.get(cleanupCount)).toBe(2);
      })
  );
});
