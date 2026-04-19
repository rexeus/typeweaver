import { DefinitionCompilationError } from "./generators/errors/definitionCompilationError.js";
import { PluginLoadingFailure } from "./generators/errors/pluginLoadingFailure.js";
import { ReservedEntityNameError } from "./generators/errors/reservedEntityNameError.js";
import { ReservedKeywordError } from "./generators/errors/reservedKeywordError.js";
import { InvalidSpecEntrypointError } from "./generators/spec/invalidSpecEntrypointError.js";
import { lookupSpecErrorEntry } from "./specErrorRegistry.js";
import type { Logger } from "./logger.js";
import type { ErrorReporter } from "./pipeline/types.js";

export type Diagnostic = {
  readonly summary: string;
  readonly contextLines: readonly string[];
  readonly hint?: string;
  readonly verboseDetails: readonly string[];
};

const withVerboseDetails = (
  error: Error,
  diagnostic: Omit<Diagnostic, "verboseDetails">
): Diagnostic => {
  const verboseDetails = error.stack
    ?.split("\n")
    .map(line => line.trimEnd())
    .filter(Boolean) ?? [error.message];

  return {
    ...diagnostic,
    verboseDetails,
  };
};

export const formatDiagnostic = (error: unknown): Diagnostic => {
  if (error instanceof PluginLoadingFailure) {
    return withVerboseDetails(error, {
      summary: `Failed to load plugin '${error.pluginName}'.`,
      contextLines: error.attempts.map(attempt => {
        return `Attempted ${attempt.path}: ${attempt.error}`;
      }),
      hint: "Check the plugin name, install the package if needed, or pass a resolvable local path.",
    });
  }

  if (error instanceof DefinitionCompilationError) {
    return withVerboseDetails(error, {
      summary: `Failed to compile '${error.filePath}'.`,
      contextLines: [error.details],
      hint: "Fix the compilation error in the spec definition and rerun the command.",
    });
  }

  if (error instanceof ReservedKeywordError) {
    return withVerboseDetails(error, {
      summary: `Reserved keyword '${error.identifier}' cannot be used as ${error.entityType}.`,
      contextLines: [`File: ${error.file}`],
      hint: "Rename the identifier to a non-reserved JavaScript or TypeScript name.",
    });
  }

  if (error instanceof ReservedEntityNameError) {
    return withVerboseDetails(error, {
      summary: `Reserved entity name '${error.entityName}' cannot be used for generated output.`,
      contextLines: [`Directory: ${error.file}`],
      hint: "Rename the resource so it does not conflict with Typeweaver's internal output structure.",
    });
  }

  if (error instanceof InvalidSpecEntrypointError) {
    return withVerboseDetails(error, {
      summary: "Spec entrypoint did not resolve to a valid SpecDefinition.",
      contextLines: [error.message],
      hint: "Export the spec as a default export, a named 'spec' export, or the module namespace.",
    });
  }

  const specEntry = lookupSpecErrorEntry(error);
  if (specEntry !== undefined && error instanceof Error) {
    return withVerboseDetails(error, {
      summary: specEntry.summary,
      contextLines: [error.message],
      hint: specEntry.hint,
    });
  }

  if (error instanceof Error) {
    return withVerboseDetails(error, {
      summary: error.message,
      contextLines: [],
      hint: "Re-run with --verbose to see the stack trace and additional error context.",
    });
  }

  return {
    summary: String(error),
    contextLines: [],
    hint: "Re-run with --verbose to see more detail.",
    verboseDetails: [String(error)],
  };
};

export const reportErrorFromDiagnostic: ErrorReporter = error => {
  const diagnostic = formatDiagnostic(error);

  return {
    summary: diagnostic.summary,
    details: [
      ...diagnostic.contextLines,
      ...(diagnostic.hint ? [diagnostic.hint] : []),
    ],
  };
};

export const writeDiagnostic = (logger: Logger, error: unknown): void => {
  const diagnostic = formatDiagnostic(error);

  logger.error(diagnostic.summary);

  for (const contextLine of diagnostic.contextLines) {
    logger.error(`  ${contextLine}`);
  }

  if (diagnostic.hint) {
    logger.warn(`Hint: ${diagnostic.hint}`);
  }

  if (logger.isVerbose) {
    for (const detail of diagnostic.verboseDetails) {
      logger.debug(detail);
    }
  }
};
