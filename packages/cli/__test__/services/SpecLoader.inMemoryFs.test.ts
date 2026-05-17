import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { MainLayer } from "@rexeus/typeweaver-gen";
import { Effect, Layer } from "effect";
import { makeInMemoryFileSystem } from "test-utils";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { SpecBundler } from "../../src/services/SpecBundler.js";
import { SpecImporter } from "../../src/services/SpecImporter.js";
import { SpecLoader } from "../../src/services/SpecLoader.js";

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
});
