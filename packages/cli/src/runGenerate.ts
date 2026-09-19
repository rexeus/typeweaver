import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Option } from "effect";
import { MissingGenerateOptionError } from "./errors/MissingGenerateOptionError.js";
import { resolveGenerateOptions } from "./resolveGenerateOptions.js";
import {
  ConfigLoader,
  getResolvedConfigPath,
} from "./services/ConfigLoader.js";
import { GeneratedOutputChecker } from "./services/GeneratedOutputChecker.js";
import { Generator } from "./services/Generator.js";

export type GenerateHandlerInput = {
  readonly input: Option.Option<string>;
  readonly output: Option.Option<string>;
  readonly config: Option.Option<string>;
  readonly plugins: Option.Option<string>;
  readonly format: Option.Option<boolean>;
  readonly "no-format": Option.Option<boolean>;
  readonly clean: Option.Option<boolean>;
  readonly "no-clean": Option.Option<boolean>;
  readonly check: Option.Option<boolean>;
  // `--verbose` is consumed at runtime-layer selection time in `cli.ts`,
  // so the handler simply ignores it. Declared here to satisfy the parsed
  // shape from `@effect/cli`.
  readonly verbose: Option.Option<boolean>;
};

const resolveBooleanFlag = (
  positive: Option.Option<boolean>,
  negative: Option.Option<boolean>
): boolean | undefined => {
  if (Option.isSome(negative) && negative.value) return false;
  if (Option.isSome(positive) && positive.value) return true;
  return undefined;
};

/**
 * Generate-subcommand body. Resolves CLI flags against an optional config
 * file and dispatches to the Generator service or, with `--check`, to the
 * read-only drift checker. `MissingGenerateOptionError` is narrowed into the
 * failure channel; anything else from `resolveGenerateOptions` propagates as a
 * defect.
 */
export const runGenerate = (args: GenerateHandlerInput) =>
  Effect.gen(function* () {
    const cwd = process.cwd();

    let loadedConfig: Partial<TypeweaverConfig> = {};
    if (Option.isSome(args.config)) {
      const configPath = getResolvedConfigPath(args.config.value, cwd);
      loadedConfig = yield* ConfigLoader.load(configPath);
      yield* Effect.logInfo(`Loaded configuration from ${configPath}`);
    }

    const format = resolveBooleanFlag(args.format, args["no-format"]);
    const clean = resolveBooleanFlag(args.clean, args["no-clean"]);

    const resolved = yield* Effect.try({
      try: () =>
        resolveGenerateOptions(
          {
            input: Option.getOrUndefined(args.input),
            output: Option.getOrUndefined(args.output),
            plugins: Option.getOrUndefined(args.plugins),
            format,
            clean,
          },
          loadedConfig,
          cwd
        ),
      catch: cause => {
        if (cause instanceof MissingGenerateOptionError) return cause;
        throw cause;
      },
    });

    const check = Option.isSome(args.check) && args.check.value;
    const verbose = Option.isSome(args.verbose) && args.verbose.value;
    const generateParams = {
      inputFile: resolved.inputPath,
      outputDir: resolved.outputDir,
      config: resolved.config,
      currentWorkingDirectory: cwd,
    } as const;

    if (check) {
      yield* GeneratedOutputChecker.check({ ...generateParams, verbose });
      return;
    }

    yield* Generator.generate(generateParams);
  });
