import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Options, ValidationError } from "@effect/cli";
import { NodeRuntime } from "@effect/platform-node";
import { Cause, Chunk, Effect, Option } from "effect";
import { ProductionLayer } from "./effectRuntime.js";
import { MissingGenerateOptionError } from "./errors/MissingGenerateOptionError.js";
import { formatErrorForCli } from "./formatErrorForCli.js";
import { resolveGenerateOptions } from "./resolveGenerateOptions.js";
import { ConfigLoader, getResolvedConfigPath } from "./services/ConfigLoader.js";
import { Generator } from "./services/Generator.js";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(moduleDir, "../package.json"), "utf-8")
) as {
  readonly version: string;
};

const inputOption = Options.text("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("path to spec entrypoint file"),
  Options.optional
);

const outputOption = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("output directory for generated files"),
  Options.optional
);

const configOption = Options.text("config").pipe(
  Options.withAlias("c"),
  Options.withDescription("path to a .js, .mjs, or .cjs configuration file"),
  Options.optional
);

const pluginsOption = Options.text("plugins").pipe(
  Options.withAlias("p"),
  Options.withDescription("comma-separated list of plugins to use"),
  Options.optional
);

// `Options.boolean(name, { negationNames })` has a known bug in
// @effect/cli@0.75.x where the inner `withDefault(!ifPresent)` short-circuits
// the outer `withDefault`. Model `--format` / `--no-format` as two flags and
// compute the effective value in the handler instead.
const formatOption = Options.boolean("format", { ifPresent: true }).pipe(
  Options.withDescription("format generated code with oxfmt (default: true)"),
  Options.optional
);

const noFormatOption = Options.boolean("no-format", { ifPresent: true }).pipe(
  Options.withDescription("disable code formatting"),
  Options.optional
);

const cleanOption = Options.boolean("clean", { ifPresent: true }).pipe(
  Options.withDescription(
    "clean output directory before generation (default: true)"
  ),
  Options.optional
);

const noCleanOption = Options.boolean("no-clean", { ifPresent: true }).pipe(
  Options.withDescription("disable cleaning output directory"),
  Options.optional
);

const resolveBooleanFlag = (
  positive: Option.Option<boolean>,
  negative: Option.Option<boolean>
): boolean | undefined => {
  if (Option.isSome(negative) && negative.value) {
    return false;
  }
  if (Option.isSome(positive) && positive.value) {
    return true;
  }
  return undefined;
};

type GenerateHandlerInput = {
  readonly input: Option.Option<string>;
  readonly output: Option.Option<string>;
  readonly config: Option.Option<string>;
  readonly plugins: Option.Option<string>;
  readonly format: Option.Option<boolean>;
  readonly "no-format": Option.Option<boolean>;
  readonly clean: Option.Option<boolean>;
  readonly "no-clean": Option.Option<boolean>;
};

const generateHandler = (args: GenerateHandlerInput) =>
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
        if (cause instanceof MissingGenerateOptionError) {
          return cause;
        }
        throw cause;
      },
    });

    yield* Generator.generate({
      inputFile: resolved.inputPath,
      outputDir: resolved.outputDir,
      config: resolved.config,
      currentWorkingDirectory: cwd,
    });
  });

const generateCommand = Command.make(
  "generate",
  {
    input: inputOption,
    output: outputOption,
    config: configOption,
    plugins: pluginsOption,
    format: formatOption,
    "no-format": noFormatOption,
    clean: cleanOption,
    "no-clean": noCleanOption,
  },
  generateHandler
).pipe(
  Command.withDescription(
    "Generate types, validators, and clients from an API spec"
  )
);

const initCommand = Command.make("init", {}, () =>
  Effect.logInfo("The init command is coming soon!")
).pipe(
  Command.withDescription("Initialize a new typeweaver project (coming soon)")
);

const cli = Command.make("typeweaver").pipe(
  Command.withDescription(
    "Type-safe API framework with code generation for TypeScript"
  ),
  Command.withSubcommands([generateCommand, initCommand])
);

const run = Command.run(cli, {
  name: "typeweaver",
  version: packageJson.version,
});

const program = run(process.argv).pipe(
  // @effect/cli surfaces help requests and validation issues as
  // `ValidationError`. The framework already prints a friendly message and
  // sets the exit code for those — skip the custom formatter so we do not
  // double-print. All other failures (tagged domain errors, plain Error,
  // defects) are rendered via `formatErrorForCli` before bubbling up to
  // `NodeRuntime.runMain`, which exits non-zero on failure.
  Effect.tapErrorCause(cause => {
    const failures = Chunk.toReadonlyArray(Cause.failures(cause));
    const defects = Chunk.toReadonlyArray(Cause.defects(cause));
    const hasOnlyValidationErrors =
      failures.length + defects.length > 0 &&
      failures.every(failure => ValidationError.isValidationError(failure)) &&
      defects.every(defect => ValidationError.isValidationError(defect));

    if (hasOnlyValidationErrors) {
      return Effect.void;
    }

    return Effect.sync(() => {
      // eslint-disable-next-line no-console
      console.error(formatErrorForCli(cause));
    });
  }),
  Effect.provide(ProductionLayer)
);

NodeRuntime.runMain(program, {
  disableErrorReporting: true,
  disablePrettyLogger: true,
});
