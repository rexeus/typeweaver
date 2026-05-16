import fs from "node:fs";
import path from "node:path";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import type {
  NormalizationError,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import type {
  InvalidSpecEntrypointError,
  SpecBundleError,
  SpecBundleOutputMissingError,
} from "../generators/spec/errors/index.js";
import { SpecBundler } from "./SpecBundler.js";
import { SpecImporter } from "./SpecImporter.js";

export type SpecLoaderConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export type LoadedSpec = {
  readonly definition: SpecDefinition;
  readonly normalizedSpec: NormalizedSpec;
};

const SPEC_DECLARATION_CONTENT = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

/**
 * End-to-end spec loading: bundle the entrypoint with rolldown, materialize
 * the `spec.d.ts` declaration alongside the bundle, dynamically import the
 * SpecDefinition, and normalize it for downstream plugins.
 *
 * Composes `SpecBundler`, `SpecImporter`, and the gen-side `normalizeSpec`.
 */
export class SpecLoader extends Effect.Service<SpecLoader>()(
  "typeweaver/SpecLoader",
  {
    effect: Effect.gen(function* () {
      const bundler = yield* SpecBundler;
      const importer = yield* SpecImporter;

      const load = (
        config: SpecLoaderConfig
      ): Effect.Effect<
        LoadedSpec,
        | InvalidSpecEntrypointError
        | NormalizationError
        | SpecBundleError
        | SpecBundleOutputMissingError
      > =>
        Effect.gen(function* () {
          yield* Effect.sync(() =>
            fs.mkdirSync(config.specOutputDir, { recursive: true })
          );

          const bundledSpecFile = yield* bundler.bundle(config);

          yield* Effect.sync(() =>
            fs.writeFileSync(
              path.join(config.specOutputDir, "spec.d.ts"),
              SPEC_DECLARATION_CONTENT
            )
          );

          const definition = yield* importer.importDefinition(bundledSpecFile);
          const normalizedSpec = yield* normalizeSpec(definition);

          return { definition, normalizedSpec };
        });

      return { load } as const;
    }),
    dependencies: [SpecBundler.Default, SpecImporter.Default],
    accessors: true,
  }
) {}
