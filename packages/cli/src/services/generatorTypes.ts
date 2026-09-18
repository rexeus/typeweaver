import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import type { Generator } from "./Generator.js";
import type { StagingAuthority } from "./internal/stagingAuthority.js";
import type { Effect } from "effect";

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
};

export type GenerateFailure = Effect.Effect.Error<
  ReturnType<typeof Generator.generate>
>;
