import { Flag } from "effect/unstable/cli";

export const inputOption = Flag.String("input").pipe(
  Flag.withAlias("i"),
  Flag.withDescription("path to spec entrypoint file"),
  Flag.optional
);

export const outputOption = Flag.String("output").pipe(
  Flag.withAlias("o"),
  Flag.withDescription("output directory for generated files"),
  Flag.optional
);

export const configOption = Flag.String("config").pipe(
  Flag.withAlias("c"),
  Flag.withDescription("path to a .js, .mjs, or .cjs configuration file"),
  Flag.optional
);

export const pluginsOption = Flag.String("plugins").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("comma-separated list of plugins to use"),
  Flag.optional
);

// `--format` / `--no-format` are modeled as separate flags and the effective
// value is computed in the handler: whichever is explicitly present takes
// precedence, and the default stays `true` when neither is passed.
export const formatOption = Flag.Boolean("format").pipe(
  Flag.withDescription("format generated code with oxfmt (default: true)"),
  Flag.optional
);

export const noFormatOption = Flag.Boolean("no-format").pipe(
  Flag.withDescription(
    "disable code formatting (takes precedence if both --format and --no-format are passed)"
  ),
  Flag.optional
);

export const cleanOption = Flag.Boolean("clean").pipe(
  Flag.withDescription(
    "clean output directory before generation (default: true)"
  ),
  Flag.optional
);

export const noCleanOption = Flag.Boolean("no-clean").pipe(
  Flag.withDescription(
    "disable cleaning output directory (takes precedence if both --clean and --no-clean are passed)"
  ),
  Flag.optional
);

export const checkOption = Flag.Boolean("check").pipe(
  Flag.withDescription(
    "generate into isolation and report drift against committed output without writing it"
  ),
  Flag.optional
);

export const verboseOption = Flag.Boolean("verbose").pipe(
  Flag.withDescription(
    "enable debug-level logging (effect spans, plugin attempts, lock acquire/release)"
  ),
  Flag.optional
);

export const pluginNameOption = Flag.String("name").pipe(
  Flag.withAlias("n"),
  Flag.withDescription("lowercase kebab-case plugin name")
);

export const pluginTargetOption = Flag.String("target").pipe(
  Flag.withAlias("t"),
  Flag.withDescription("new directory that will receive the plugin scaffold")
);

export const initTargetOption = Flag.String("target").pipe(
  Flag.withAlias("t"),
  Flag.withDescription("project directory to create or update explicitly")
);

export const forceOption = Flag.Boolean("force").pipe(
  Flag.withDescription(
    "overwrite conflicting starter files in a non-empty target"
  ),
  Flag.optional
);

export const dryRunOption = Flag.Boolean("dry-run").pipe(
  Flag.withDescription("plan the project without writing files"),
  Flag.optional
);

export const configFormatOption = Flag.Literals("config-format", [
  "mjs",
  "cjs",
  "js",
]).pipe(
  Flag.withDescription("module format for the generated configuration"),
  Flag.optional
);

export const jsonOption = Flag.Boolean("json").pipe(
  Flag.withDescription("emit a stable machine-readable JSON report"),
  Flag.optional
);

export const strictOption = Flag.Boolean("strict").pipe(
  Flag.withDescription("fail validation when warnings are present"),
  Flag.optional
);

export const failOnOption = Flag.Literals("fail-on", [
  "error",
  "warning",
  "info",
]).pipe(
  Flag.withDescription("lowest issue severity that exits non-zero"),
  Flag.optional
);

export const deepOption = Flag.Boolean("deep").pipe(
  Flag.withDescription(
    "bundle, normalize, and validate the spec without writing project output"
  ),
  Flag.optional
);
