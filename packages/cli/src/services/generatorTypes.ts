import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import type { Generator } from "./Generator.js";
import type { StagingAuthority } from "./internal/stagingAuthority.js";
import type { Error as EffectError } from "effect/Effect";
export type GenerateParams = {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory?: string;
  /**
   * Internal, unforgeable authority that allows the CLI check pipeline to
   * generate into an isolated stage under the reserved staging namespace. It is
   * created only by that pipeline; public programmatic callers omit it and are
   * subject to the reserved-path guards.
   */
  readonly stagingAuthority?: StagingAuthority;
  /** Runtime-resolution base used only with an internal staging authority. */
  readonly externalImportBase?: string;
};

export type GenerateFailure = EffectError<
  ReturnType<typeof Generator.generate>
>;
