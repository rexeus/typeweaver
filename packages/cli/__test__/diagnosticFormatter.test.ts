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
import { describe, expect, test } from "vitest";
import {
  formatDiagnostic,
  reportErrorFromDiagnostic,
  writeDiagnostic,
} from "../src/diagnosticFormatter.js";
import { DefinitionCompilationError } from "../src/generators/errors/definitionCompilationError.js";
import { PluginLoadingFailure } from "../src/generators/errors/pluginLoadingFailure.js";
import { ReservedEntityNameError } from "../src/generators/errors/reservedEntityNameError.js";
import { ReservedKeywordError } from "../src/generators/errors/reservedKeywordError.js";
import { InvalidSpecEntrypointError } from "../src/generators/spec/InvalidSpecEntrypointError.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type { Logger } from "../src/logger.js";

describe("formatDiagnostic", () => {
  test("formats plugin loading failures", () => {
    const diagnostic = formatDiagnostic(
      new PluginLoadingFailure("clients", [
        {
          path: "@rexeus/typeweaver-clients",
          error: "Cannot find package",
        },
      ])
    );

    expect(diagnostic.summary).toBe("Failed to load plugin 'clients'.");
    expect(diagnostic.contextLines).toEqual([
      "Attempted @rexeus/typeweaver-clients: Cannot find package",
    ]);
  });

  test("formats definition compilation errors", () => {
    const diagnostic = formatDiagnostic(
      new DefinitionCompilationError("spec/index.ts", "Unexpected token")
    );

    expect(diagnostic.summary).toBe("Failed to compile 'spec/index.ts'.");
    expect(diagnostic.contextLines).toEqual(["Unexpected token"]);
  });

  test("formats reserved keyword errors", () => {
    const diagnostic = formatDiagnostic(
      new ReservedKeywordError("operationId", "class", "spec/index.ts")
    );

    expect(diagnostic.summary).toBe(
      "Reserved keyword 'class' cannot be used as operationId."
    );
    expect(diagnostic.contextLines).toEqual(["File: spec/index.ts"]);
  });

  test("formats reserved entity name errors", () => {
    const diagnostic = formatDiagnostic(
      new ReservedEntityNameError("responses", "generated/responses")
    );

    expect(diagnostic.summary).toBe(
      "Reserved entity name 'responses' cannot be used for generated output."
    );
    expect(diagnostic.contextLines).toEqual(["Directory: generated/responses"]);
  });

  test("formats invalid spec entrypoint errors", () => {
    const diagnostic = formatDiagnostic(
      new InvalidSpecEntrypointError("/tmp/spec.js")
    );

    expect(diagnostic.summary).toBe(
      "Spec entrypoint did not resolve to a valid SpecDefinition."
    );
    expect(diagnostic.contextLines[0]).toContain("/tmp/spec.js");
  });

  test("formats duplicate operation id errors", () => {
    const diagnostic = formatDiagnostic(
      new DuplicateOperationIdError("getTodo")
    );

    expect(diagnostic.summary).toBe("Operation IDs must be globally unique.");
    expect(diagnostic.contextLines[0]).toContain("getTodo");
  });

  test("formats duplicate route errors", () => {
    const diagnostic = formatDiagnostic(
      new DuplicateRouteError("GET", "/todos/:id", "/todos/{id}")
    );

    expect(diagnostic.summary).toBe(
      "Two operations resolve to the same route."
    );
    expect(diagnostic.contextLines[0]).toContain("GET /todos/:id");
  });

  test("formats empty operation response errors", () => {
    const diagnostic = formatDiagnostic(
      new EmptyOperationResponsesError("getTodo")
    );

    expect(diagnostic.summary).toBe("An operation is missing responses.");
    expect(diagnostic.contextLines[0]).toContain("getTodo");
  });

  test("formats empty resource operation errors", () => {
    const diagnostic = formatDiagnostic(
      new EmptyResourceOperationsError("todo")
    );

    expect(diagnostic.summary).toBe("A resource is missing operations.");
    expect(diagnostic.contextLines[0]).toContain("todo");
  });

  test("formats empty spec resource errors", () => {
    const diagnostic = formatDiagnostic(new EmptySpecResourcesError());

    expect(diagnostic.summary).toBe("The spec does not define any resources.");
    expect(diagnostic.contextLines[0]).toContain("at least one resource");
  });

  test("formats invalid derived response errors", () => {
    const diagnostic = formatDiagnostic(
      new InvalidDerivedResponseError("TodoResponse")
    );

    expect(diagnostic.summary).toBe(
      "A derived response definition is invalid."
    );
    expect(diagnostic.contextLines[0]).toContain("TodoResponse");
  });

  test("formats invalid operation id errors", () => {
    const diagnostic = formatDiagnostic(
      new InvalidOperationIdError("get_todo")
    );

    expect(diagnostic.summary).toBe(
      "An operation ID uses an unsupported naming style."
    );
    expect(diagnostic.contextLines[0]).toContain("get_todo");
  });

  test("formats invalid request schema errors", () => {
    const diagnostic = formatDiagnostic(
      new InvalidRequestSchemaError("getTodo", "body")
    );

    expect(diagnostic.summary).toBe("An operation request schema is invalid.");
    expect(diagnostic.contextLines[0]).toContain("request.body");
  });

  test("formats invalid resource name errors", () => {
    const diagnostic = formatDiagnostic(
      new InvalidResourceNameError("todo_items")
    );

    expect(diagnostic.summary).toBe(
      "A resource name uses an unsupported naming style."
    );
    expect(diagnostic.contextLines[0]).toContain("todo_items");
  });

  test("formats missing derived response parent errors", () => {
    const diagnostic = formatDiagnostic(
      new MissingDerivedResponseParentError("TodoResponse", "BaseResponse")
    );

    expect(diagnostic.summary).toBe(
      "A derived response references a missing parent."
    );
    expect(diagnostic.contextLines[0]).toContain("BaseResponse");
  });

  test("formats path parameter mismatch errors", () => {
    const diagnostic = formatDiagnostic(
      new PathParameterMismatchError(
        "getTodo",
        "/todos/{id}",
        ["id"],
        ["todoId"]
      )
    );

    expect(diagnostic.summary).toBe(
      "An operation path does not match its declared request parameters."
    );
    expect(diagnostic.contextLines[0]).toContain("todoId");
  });

  test("formats derived response cycle errors", () => {
    const diagnostic = formatDiagnostic(
      new DerivedResponseCycleError("TodoResponse")
    );

    expect(diagnostic.summary).toBe("A derived response contains a cycle.");
    expect(diagnostic.contextLines[0]).toContain("TodoResponse");
  });

  test("keeps unknown Error instances useful and suggests verbose mode", () => {
    const diagnostic = formatDiagnostic(new Error("Unexpected failure"));

    expect(diagnostic.summary).toBe("Unexpected failure");
    expect(diagnostic.hint).toBe(
      "Re-run with --verbose to see the stack trace and additional error context."
    );
    expect(diagnostic.verboseDetails[0]).toContain("Unexpected failure");
  });

  test("formats non-Error throwables", () => {
    const diagnostic = formatDiagnostic("plain failure");

    expect(diagnostic.summary).toBe("plain failure");
    expect(diagnostic.contextLines).toEqual([]);
    expect(diagnostic.hint).toBe("Re-run with --verbose to see more detail.");
    expect(diagnostic.verboseDetails).toEqual(["plain failure"]);
  });
});

describe("reportErrorFromDiagnostic", () => {
  test("bridges a diagnostic into an ErrorReport with context lines and hint", () => {
    const report = reportErrorFromDiagnostic(
      new DuplicateOperationIdError("getTodo")
    );

    expect(report.summary).toBe("Operation IDs must be globally unique.");
    expect(report.details[0]).toContain("getTodo");
    expect(report.details).toContain(
      "Rename one of the duplicated operation IDs so every operation is unique across the spec."
    );
  });

  test("appends the diagnostic hint exactly once when present", () => {
    const report = reportErrorFromDiagnostic(
      new DuplicateOperationIdError("getTodo")
    );

    const diagnosticHints = report.details.filter(detail =>
      detail.startsWith("Rename one of")
    );
    expect(diagnosticHints).toHaveLength(1);
  });

  test("falls back to the error message for unknown throwables", () => {
    const report = reportErrorFromDiagnostic(new Error("unexpected boom"));

    expect(report.summary).toBe("unexpected boom");
  });
});

describe("writeDiagnostic", () => {
  test("routes summary to error() and hint to warn()", () => {
    const logger = createTestLogger();

    writeDiagnostic(logger, new DuplicateOperationIdError("getTodo"));

    expect(logger.error).toHaveBeenCalledWith(
      "Operation IDs must be globally unique."
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("getTodo")
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/^Hint:/));
  });

  test("emits stack details via debug only when verbose is enabled", () => {
    const quietLogger: Logger = { ...createTestLogger(), isVerbose: false };
    const verboseLogger: Logger = { ...createTestLogger(), isVerbose: true };

    writeDiagnostic(quietLogger, new Error("quiet"));
    writeDiagnostic(verboseLogger, new Error("verbose"));

    expect(quietLogger.debug).not.toHaveBeenCalled();
    expect(verboseLogger.debug).toHaveBeenCalled();
  });
});
