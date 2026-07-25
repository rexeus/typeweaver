import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import type { Generator } from "./Generator.js";
import type { Effect } from "effect";

export type GenerateParams = {
  readonly inputFile: string;
  readonly outputDir: string;
  readonly config?: TypeweaverConfig;
  readonly currentWorkingDirectory?: string;
};

export type GenerateFailure = Effect.Effect.Error<
  ReturnType<typeof Generator.generate>
>;
