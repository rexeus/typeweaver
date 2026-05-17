import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { MainLayer } from "@rexeus/typeweaver-gen";
import { FileSystem } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { Effect, Either, Layer } from "effect";
import { makeInMemoryFileSystem } from "test-utils";
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
  }) as unknown as SpecDefinition;
};

const stubSpecBundlerLayer = (
  bundledSpecFile: string
): Layer.Layer<SpecBundler> =>
  Layer.succeed(SpecBundler, {
    bundle: () => Effect.succeed(bundledSpecFile),
  } as SpecBundler["Type"]);

const stubSpecImporterLayer = (
  definition: SpecDefinition
): Layer.Layer<SpecImporter> =>
  Layer.succeed(SpecImporter, {
    importDefinition: () => Effect.succeed(definition),
  } as SpecImporter["Type"]);

describe("SpecLoader against InMemoryFileSystem", () => {
  test("writes the canonical spec.d.ts declaration into specOutputDir", async () => {
    const { layer: fileSystemLayer, state } = makeInMemoryFileSystem();
    const layer = Layer.provide(
      SpecLoader.DefaultWithoutDependencies,
      Layer.mergeAll(
        stubSpecBundlerLayer("/out/spec/spec.js"),
        stubSpecImporterLayer(aMinimalSpec()),
        MainLayer,
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
      Layer.mergeAll(
        stubSpecBundlerLayer("/out/nested/spec/spec.js"),
        stubSpecImporterLayer(aMinimalSpec()),
        MainLayer,
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

  test("wraps a write failure of spec.d.ts in SpecOutputWriteError", async () => {
    const { layer: baseFileSystemLayer } = makeInMemoryFileSystem();
    const writeFailure = new SystemError({
      reason: "PermissionDenied",
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
      Layer.mergeAll(
        stubSpecBundlerLayer("/out/spec/spec.js"),
        stubSpecImporterLayer(aMinimalSpec()),
        MainLayer,
        failingFsLayer
      )
    );

    const either = await Effect.runPromise(
      Effect.either(
        Effect.gen(function* () {
          const specLoader = yield* SpecLoader;
          yield* specLoader.load({
            inputFile: "/in/spec/index.ts",
            specOutputDir: "/out/spec",
          });
        }).pipe(Effect.provide(layer))
      )
    );

    expect(Either.isLeft(either)).toBe(true);
    if (!Either.isLeft(either)) return;
    expect(either.left).toBeInstanceOf(SpecOutputWriteError);
    const error = either.left as SpecOutputWriteError;
    expect(error.path).toBe("/out/spec/spec.d.ts");
    expect(error.cause).toBe(writeFailure);
  });
});
