import type { GenerationSummary } from "./generationResult.js";

const ANSI = {
  reset: "\u001B[0m",
  dim: "\u001B[2m",
  blue: "\u001B[34m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
  cyan: "\u001B[36m",
} as const;

export type LoggerOptions = {
  readonly verbose?: boolean;
  readonly quiet?: boolean;
  readonly color?: boolean;
  readonly stdout?: Pick<NodeJS.WriteStream, "isTTY" | "write">;
  readonly stderr?: Pick<NodeJS.WriteStream, "isTTY" | "write">;
};

export type Logger = {
  readonly isVerbose: boolean;
  readonly debug: (message: string) => void;
  readonly info: (message: string) => void;
  readonly success: (message: string) => void;
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
  readonly step: (message: string) => void;
  readonly summary: (summary: GenerationSummary) => void;
};

export const createLogger = (options: LoggerOptions = {}): Logger => {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const isVerbose = options.verbose ?? false;
  const isQuiet = options.quiet ?? false;
  const colorEnabled =
    options.color ??
    (!process.env.NO_COLOR && Boolean(stdout.isTTY) && Boolean(stderr.isTTY));

  const colorize = (color: string, value: string): string => {
    if (!colorEnabled) {
      return value;
    }

    return `${color}${value}${ANSI.reset}`;
  };

  const write = (
    stream: Pick<NodeJS.WriteStream, "write">,
    message: string,
    visible: boolean
  ): void => {
    if (!visible) {
      return;
    }

    stream.write(`${message}\n`);
  };

  const formatLabel = (label: string, color: string): string => {
    return colorize(color, label);
  };

  const logger: Logger = {
    isVerbose,
    debug: (message: string) => {
      write(stderr, `${formatLabel("debug", ANSI.dim)} ${message}`, isVerbose && !isQuiet);
    },
    info: (message: string) => {
      write(stdout, message, !isQuiet);
    },
    success: (message: string) => {
      write(stdout, `${formatLabel("✔", ANSI.green)} ${message}`, !isQuiet);
    },
    warn: (message: string) => {
      write(stderr, `${formatLabel("▲", ANSI.yellow)} ${message}`, true);
    },
    error: (message: string) => {
      write(stderr, `${formatLabel("✖", ANSI.red)} ${message}`, true);
    },
    step: (message: string) => {
      write(stdout, `${formatLabel("→", ANSI.cyan)} ${message}`, !isQuiet);
    },
    summary: (summary: GenerationSummary) => {
      if (isQuiet) {
        return;
      }

      const generatedCount = summary.generatedFiles.length;
      const action =
        summary.mode === "validate"
          ? "Validated"
          : summary.mode === "init"
            ? "Initialized"
            : summary.mode === "migrate"
              ? "Migration guidance"
              : "Generated";
      const suffix = summary.dryRun ? " (dry run)" : "";

      if (summary.mode === "migrate") {
        const adviceCount = summary.advisoryCount ?? 0;

        write(
          stdout,
          `${formatLabel("Summary", ANSI.blue)} ${action}${suffix}: ${adviceCount} advisory step(s)`,
          true
        );

        if (summary.detectedVersion) {
          write(stdout, `  from: ${summary.detectedVersion}`, true);
        }

        return;
      }

      if (summary.mode === "doctor") {
        write(
          stdout,
          `${formatLabel("Summary", ANSI.blue)} Doctor: ${summary.passedChecks ?? 0} passed, ${summary.warnedChecks ?? 0} warned, ${summary.failedChecks ?? 0} failed, ${summary.skippedChecks ?? 0} skipped (${summary.totalChecks ?? 0} total)`,
          true
        );

        if (summary.targetConfigPath) {
          write(stdout, `  config: ${summary.targetConfigPath}`, true);
        }

        return;
      }

      write(
        stdout,
        `${formatLabel("Summary", ANSI.blue)} ${action}${suffix}: ${summary.resourceCount} resource(s), ${summary.operationCount} operation(s), ${summary.responseCount} response(s), ${generatedCount} file(s), ${summary.pluginCount} plugin(s)`,
        true
      );

      if (summary.targetOutputDir && summary.mode === "generate") {
        write(stdout, `  output: ${summary.targetOutputDir}`, true);
      }

      if (summary.targetConfigPath && summary.mode === "init") {
        write(stdout, `  config: ${summary.targetConfigPath}`, true);
      }

      if (summary.warnings.length > 0) {
        write(stdout, `  warnings: ${summary.warnings.length}`, true);

        if (isVerbose) {
          for (const warning of summary.warnings) {
            write(stdout, `  ! ${warning}`, true);
          }
        }
      }

      if (isVerbose && generatedCount > 0) {
        for (const file of summary.generatedFiles) {
          write(stdout, `  - ${file}`, true);
        }
      }
    },
  };

  return logger;
};
