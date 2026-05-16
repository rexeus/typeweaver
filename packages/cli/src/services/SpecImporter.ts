import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import {
  InvalidSpecEntrypointError,
  SpecBundleError,
} from "../generators/spec/errors/index.js";
import { isSpecDefinition } from "../generators/spec/specGuards.js";

/**
 * Loads a bundled spec module and verifies it exposes a SpecDefinition via
 * a `spec` export, `default` export, or the module namespace itself.
 *
 * Cache-busts the dynamic import on every call by appending a content hash
 * to the module URL, so successive generation runs see the latest bundle.
 */
export class SpecImporter extends Effect.Service<SpecImporter>()(
  "typeweaver/SpecImporter",
  {
    effect: Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;

      const importDefinition = (
        bundledSpecFile: string
      ): Effect.Effect<
        SpecDefinition,
        InvalidSpecEntrypointError | SpecBundleError
      > =>
        Effect.gen(function* () {
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
              const specModule = (await import(moduleUrl.toString())) as {
                readonly spec?: unknown;
                readonly default?: unknown;
              };
              const definition =
                specModule.spec ?? specModule.default ?? specModule;

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
    }),
    accessors: true,
  }
) {}
