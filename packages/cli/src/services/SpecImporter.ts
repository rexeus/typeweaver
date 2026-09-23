import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { Context, Effect, FileSystem, Layer } from "effect";
import {
  InvalidSpecEntrypointError,
  SpecBundleError,
} from "./errors/specErrors.js";
import { isSpecDefinition } from "./internal/specGuards.js";

export type SpecImporterShape = {
  readonly importDefinition: (
    bundledSpecFile: string
  ) => Effect.Effect<
    SpecDefinition,
    InvalidSpecEntrypointError | SpecBundleError
  >;
};

const readModuleExport = (moduleNamespace: unknown, name: string): unknown =>
  typeof moduleNamespace === "object" &&
  moduleNamespace !== null &&
  name in moduleNamespace
    ? Reflect.get(moduleNamespace, name)
    : undefined;

const makeSpecImporter: Effect.Effect<
  SpecImporterShape,
  never,
  FileSystem.FileSystem
> = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  const importDefinition: SpecImporterShape["importDefinition"] = Effect.fn(
    "typeweaver.SpecImporter.importDefinition"
  )(function* (bundledSpecFile: string) {
    const bundleContents = yield* fileSystem
      .readFileString(bundledSpecFile)
      .pipe(
        Effect.mapError(
          cause =>
            new SpecBundleError({
              inputFile: bundledSpecFile,
              cause,
            })
        )
      );

    const contentHash = createHash("sha256")
      .update(bundleContents)
      .digest("hex");
    const moduleUrl = pathToFileURL(bundledSpecFile);

    moduleUrl.searchParams.set("content", contentHash);

    return yield* Effect.tryPromise({
      try: async () => {
        const specModule: unknown = await import(moduleUrl.toString());
        const definition =
          readModuleExport(specModule, "spec") ??
          readModuleExport(specModule, "default") ??
          specModule;

        if (!isSpecDefinition(definition)) {
          throw new InvalidSpecEntrypointError({
            specEntrypoint: bundledSpecFile,
          });
        }

        return definition;
      },
      catch: error => {
        if (error instanceof InvalidSpecEntrypointError) {
          return error;
        }
        return new SpecBundleError({
          inputFile: bundledSpecFile,
          cause: error,
        });
      },
    });
  });

  return { importDefinition } as const;
});

/**
 * Loads a bundled spec module and verifies it exposes a SpecDefinition via
 * a `spec` export, `default` export, or the module namespace itself.
 *
 * Cache-busts the dynamic import on every call by appending a content hash
 * to the module URL, so successive generation runs see the latest bundle.
 */
export class SpecImporter extends Context.Service<
  SpecImporter,
  SpecImporterShape
>()("typeweaver/SpecImporter") {
  static readonly make = (service: SpecImporterShape) => service;

  static readonly DefaultWithoutDependencies: Layer.Layer<
    SpecImporter,
    never,
    FileSystem.FileSystem
  > = Layer.effect(SpecImporter, makeSpecImporter);

  static readonly Default: Layer.Layer<
    SpecImporter,
    never,
    FileSystem.FileSystem
  > = SpecImporter.DefaultWithoutDependencies;

  static readonly importDefinition = (bundledSpecFile: string) =>
    SpecImporter.use(service => service.importDefinition(bundledSpecFile));
}
