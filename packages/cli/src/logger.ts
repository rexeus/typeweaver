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

/**
 * Logger that discards every message. Use it to suppress noise from subsystems
 * that take a logger but whose output is irrelevant to the caller.
 */
export const NOOP_LOGGER: Logger = {
  isVerbose: false,
  debug: () => {},
  info: () => {},
  success: () => {},
  warn: () => {},
  error: () => {},
  step: () => {},
  summary: () => {},
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

  const summaryLabel = formatLabel("Summary", ANSI.blue);

  const writeGenerateSummary = (
    summary: Extract<GenerationSummary, { mode: "generate" }>
  ): void => {
    const suffix = summary.dryRun ? " (dry run)" : "";

    write(
      stdout,
      `${summaryLabel} Generated${suffix}: ${summary.resourceCount} resource(s), ${summary.operationCount} operation(s), ${summary.responseCount} response(s), ${summary.generatedFiles.length} file(s), ${summary.pluginCount} plugin(s)`,
      true
    );
    write(stdout, `  output: ${summary.targetOutputDir}`, true);

    if (summary.warnings.length > 0) {
      write(stdout, `  warnings: ${summary.warnings.length}`, true);

      if (isVerbose) {
        for (const warning of summary.warnings) {
          write(stdout, `  ! ${warning}`, true);
        }
      }
    }

    if (isVerbose && summary.generatedFiles.length > 0) {
      for (const file of summary.generatedFiles) {
        write(stdout, `  - ${file}`, true);
      }
    }
  };

  const writeInitSummary = (
    summary: Extract<GenerationSummary, { mode: "init" }>
  ): void => {
    write(
      stdout,
      `${summaryLabel} Initialized: ${summary.resourceCount} resource(s), ${summary.operationCount} operation(s), ${summary.responseCount} response(s), ${summary.generatedFiles.length} file(s), ${summary.pluginCount} plugin(s)`,
      true
    );
    write(stdout, `  config: ${summary.targetConfigPath}`, true);

    if (isVerbose && summary.generatedFiles.length > 0) {
      for (const file of summary.generatedFiles) {
        write(stdout, `  - ${file}`, true);
      }
    }
  };

  const writeMigrateSummary = (
    summary: Extract<GenerationSummary, { mode: "migrate" }>
  ): void => {
    write(
      stdout,
      `${summaryLabel} Migration guidance: ${summary.advisoryCount} advisory step(s)`,
      true
    );
    write(stdout, `  from: ${summary.detectedVersion}`, true);
  };

  const writeDoctorSummary = (
    summary: Extract<GenerationSummary, { mode: "doctor" }>
  ): void => {
    write(
      stdout,
      `${summaryLabel} Doctor: ${summary.passedChecks} passed, ${summary.warnedChecks} warned, ${summary.failedChecks} failed, ${summary.skippedChecks} skipped (${summary.totalChecks} total)`,
      true
    );
    write(stdout, `  config: ${summary.targetConfigPath}`, true);
  };

  const logger: Logger = {
    isVerbose,
    debug: (message: string) => {
      write(
        stderr,
        `${formatLabel("debug", ANSI.dim)} ${message}`,
        isVerbose && !isQuiet
      );
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

      switch (summary.mode) {
        case "generate":
          writeGenerateSummary(summary);
          return;
        case "init":
          writeInitSummary(summary);
          return;
        case "migrate":
          writeMigrateSummary(summary);
          return;
        case "doctor":
          writeDoctorSummary(summary);
          return;
      }
    },
  };

  return logger;
};
