import {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  DuplicateRouteError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidDerivedResponseError,
  InvalidOperationIdError,
  InvalidRequestSchemaError,
  InvalidResourceNameError,
  MissingDerivedResponseParentError,
  PathParameterMismatchError,
} from "@rexeus/typeweaver-gen";
import { DefinitionCompilationError } from "./generators/errors/definitionCompilationError.js";
import { PluginLoadingFailure } from "./generators/errors/pluginLoadingFailure.js";
import { ReservedEntityNameError } from "./generators/errors/reservedEntityNameError.js";
import { ReservedKeywordError } from "./generators/errors/reservedKeywordError.js";
import { InvalidSpecEntrypointError } from "./generators/spec/InvalidSpecEntrypointError.js";
import type { Logger } from "./logger.js";

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

  if (error instanceof DuplicateOperationIdError) {
    return withVerboseDetails(error, {
      summary: "Operation IDs must be globally unique.",
      contextLines: [error.message],
      hint: "Rename one of the duplicated operation IDs so every operation is unique across the spec.",
    });
  }

  if (error instanceof DuplicateRouteError) {
    return withVerboseDetails(error, {
      summary: "Two operations resolve to the same route.",
      contextLines: [error.message],
      hint: "Change the route path or method so the normalized route is unique.",
    });
  }

  if (error instanceof EmptyOperationResponsesError) {
    return withVerboseDetails(error, {
      summary: "An operation is missing responses.",
      contextLines: [error.message],
      hint: "Add at least one response to every operation.",
    });
  }

  if (error instanceof EmptyResourceOperationsError) {
    return withVerboseDetails(error, {
      summary: "A resource is missing operations.",
      contextLines: [error.message],
      hint: "Add at least one operation to every resource.",
    });
  }

  if (error instanceof EmptySpecResourcesError) {
    return withVerboseDetails(error, {
      summary: "The spec does not define any resources.",
      contextLines: [error.message],
      hint: "Add at least one resource before generating or validating.",
    });
  }

  if (error instanceof InvalidDerivedResponseError) {
    return withVerboseDetails(error, {
      summary: "A derived response definition is invalid.",
      contextLines: [error.message],
      hint: "Check derived response lineage metadata and ensure it points to a valid canonical response.",
    });
  }

  if (error instanceof InvalidOperationIdError) {
    return withVerboseDetails(error, {
      summary: "An operation ID uses an unsupported naming style.",
      contextLines: [error.message],
      hint: "Use camelCase or PascalCase for operation IDs.",
    });
  }

  if (error instanceof InvalidRequestSchemaError) {
    return withVerboseDetails(error, {
      summary: "An operation request schema is invalid.",
      contextLines: [error.message],
      hint: "Check the request schema shape and ensure every request section is a supported schema definition.",
    });
  }

  if (error instanceof InvalidResourceNameError) {
    return withVerboseDetails(error, {
      summary: "A resource name uses an unsupported naming style.",
      contextLines: [error.message],
      hint: "Use camelCase singular nouns when possible; PascalCase is also supported.",
    });
  }

  if (error instanceof MissingDerivedResponseParentError) {
    return withVerboseDetails(error, {
      summary: "A derived response references a missing parent.",
      contextLines: [error.message],
      hint: "Define the canonical response first or update the derived response to reference an existing parent.",
    });
  }

  if (error instanceof PathParameterMismatchError) {
    return withVerboseDetails(error, {
      summary: "An operation path does not match its declared request parameters.",
      contextLines: [error.message],
      hint: "Make sure every path placeholder is declared in request.param and there are no extra path params.",
    });
  }

  if (error instanceof DerivedResponseCycleError) {
    return withVerboseDetails(error, {
      summary: "A derived response contains a cycle.",
      contextLines: [error.message],
      hint: "Break the response inheritance cycle so every derived response has an acyclic lineage.",
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
