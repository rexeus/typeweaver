import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { MainLayer } from "@rexeus/typeweaver-gen";
import { Effect, FileSystem, Layer, Result } from "effect";
import { PlatformError, systemError } from "effect/PlatformError";
import { makeInMemoryFileSystem } from "test-utils/src/effect/index.js";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { SpecOutputWriteError } from "../../src/services/errors/SpecOutputWriteError.js";
import {
  SpecBundler,
  SpecImporter,
  SpecLoader,
} from "../../src/services/index.js";

/**
 * The exact content `SpecLoader` writes to `<specOutputDir>/spec.d.ts`. The
 * test asserts byte-for-byte equality so the generated declaration stays
 * stable across refactors.
 */
const SPEC_DECLARATION_CONTENT = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

const aMinimalSpec = (): SpecDefinition => {
  const itemLoaded = defineResponse({
    name: "ItemLoaded",
    statusCode: HttpStatusCode.OK,
    description: "Item loaded",
    body: z.object({ id: z.string() }),
  });

  return defineSpec({
    metadata: { title: "Items API", version: "1.0.0" },
    resources: {
      item: {
        operations: [
          defineOperation({
            operationId: "getItem",
            path: "/items/:itemId",
            method: HttpMethod.GET,
            summary: "Get item",
            request: { param: z.object({ itemId: z.string() }) },
            responses: [itemLoaded],
          }),
        ],
      },
    },
  });
};

const stubSpecBundlerLayer = (
  bundledSpecFile: string
): Layer.Layer<SpecBundler> => {
  const service = SpecBundler.make({
    bundle: () => Effect.succeed(bundledSpecFile),
  });

  return Layer.succeed(SpecBundler, service);
};

const stubSpecImporterLayer = (
  definition: SpecDefinition
): Layer.Layer<SpecImporter> => {
  const service = SpecImporter.make({
    importDefinition: () => Effect.succeed(definition),
  });

  return Layer.succeed(SpecImporter, service);
};

describe("SpecLoader against InMemoryFileSystem", () => {
  test("writes the canonical spec.d.ts declaration into specOutputDir", async () => {
    const { layer: fileSystemLayer, state } = makeInMemoryFileSystem();
    const layer = Layer.provide(
      SpecLoader.DefaultWithoutDependencies,
      // `provideMerge` feeds the in-memory FileSystem into MainLayer
      // (ContextBuilder consumes the tag) while keeping it exposed for
      // SpecLoader's own writes.
      Layer.provideMerge(
        Layer.mergeAll(
          stubSpecBundlerLayer("/out/spec/spec.js"),
          stubSpecImporterLayer(aMinimalSpec()),
          MainLayer
        ),
        fileSystemLayer
      )
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const specLoader = yield* SpecLoader;
        yield* specLoader.load({
          inputFile: "/in/spec/index.ts",
          specOutputDir: "/out/spec",
        });
      }).pipe(Effect.provide(layer))
    );

    expect(state.readFile("/out/spec/spec.d.ts")).toBe(
      SPEC_DECLARATION_CONTENT
    );
  });
  test("ensures specOutputDir exists before writing the declaration", async () => {
    const { layer: fileSystemLayer, state } = makeInMemoryFileSystem();
    const layer = Layer.provide(
      SpecLoader.DefaultWithoutDependencies,
      Layer.provideMerge(
        Layer.mergeAll(
          stubSpecBundlerLayer("/out/nested/spec/spec.js"),
          stubSpecImporterLayer(aMinimalSpec()),
          MainLayer
        ),
        fileSystemLayer
      )
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const specLoader = yield* SpecLoader;
        yield* specLoader.load({
          inputFile: "/in/spec/index.ts",
          specOutputDir: "/out/nested/spec",
        });
      }).pipe(Effect.provide(layer))
    );

    expect(state.listDirectories()).toEqual(
      expect.arrayContaining(["/out/nested/spec"])
    );
    expect(state.hasFile("/out/nested/spec/spec.d.ts")).toBe(true);
  });
});

describe("SpecLoader declaration write failures", () => {
  test("wraps a write failure of spec.d.ts in SpecOutputWriteError", async () => {
    const { layer: baseFileSystemLayer } = makeInMemoryFileSystem();
    const writeFailure = systemError({
      _tag: "PermissionDenied",
      module: "FileSystem",
      method: "writeFileString",
      pathOrDescriptor: "/out/spec/spec.d.ts",
      description: "read-only filesystem",
    });
    const failingFsLayer = Layer.effect(
      FileSystem.FileSystem,
      Effect.gen(function* () {
        const base = yield* FileSystem.FileSystem;
        return FileSystem.makeNoop({
          ...base,
          writeFileString: () => Effect.fail(writeFailure),
        });
      })
    ).pipe(Layer.provide(baseFileSystemLayer));

    const layer = Layer.provide(
      SpecLoader.DefaultWithoutDependencies,
      Layer.provideMerge(
        Layer.mergeAll(
          stubSpecBundlerLayer("/out/spec/spec.js"),
          stubSpecImporterLayer(aMinimalSpec()),
          MainLayer
        ),
        failingFsLayer
      )
    );

    const either = await Effect.runPromise(
      Effect.result(
        Effect.gen(function* () {
          const specLoader = yield* SpecLoader;
          yield* specLoader.load({
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          });
        }).pipe(Effect.provide(layer))
      )
    );

    expect(Result.isFailure(either)).toBe(true);
    if (!Result.isFailure(either)) return;
    const original = either.failure;
    expect(original).toBeInstanceOf(SpecOutputWriteError);
    if (!(original instanceof SpecOutputWriteError)) return;
    const error = original;
    expect(error.path).toBe("/out/spec/spec.d.ts");
    expect(error.cause).toBeInstanceOf(PlatformError);
    if (!(error.cause instanceof PlatformError)) return;
    expect(error.cause.reason._tag).toBe(writeFailure.reason._tag);
    if (!("method" in error.cause.reason)) return;
    expect(error.cause.reason.method).toBe("writeFileString");
    if (!("pathOrDescriptor" in error.cause.reason)) return;
    expect(error.cause.reason.pathOrDescriptor).toBe("/out/spec/spec.d.ts");
  });
});
