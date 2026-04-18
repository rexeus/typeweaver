import { describe, expect, test, vi } from "vitest";
import {
  REPORT_SCHEMA_VERSION,
  reportValidationJson,
  reportValidationText,
} from "../src/validate/reporter.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type { ValidationReport } from "../src/validate/types.js";

const createReport = (
  overrides: Partial<ValidationReport> = {}
): ValidationReport => ({
  checks: [
    {
      id: "spec/load",
      label: "Spec load",
      status: "pass",
      summary: "Spec loaded.",
      details: [],
    },
  ],
  issues: [],
  stats: {
    errors: 0,
    warnings: 0,
    infos: 0,
    resources: 1,
    operations: 2,
    responses: 3,
  },
  hasErrors: false,
  failOn: "error",
  ...overrides,
});

describe("reportValidationText", () => {
  test("logs successful checks via success()", () => {
    const logger = createTestLogger();

    reportValidationText(logger, createReport());

    expect(logger.success).toHaveBeenCalledWith(
      expect.stringContaining("Spec load: Spec loaded.")
    );
  });

  test("routes issues to the correct severity channel with stable prefixes", () => {
    const logger = createTestLogger();

    reportValidationText(
      logger,
      createReport({
        issues: [
          {
            code: "TW-SPEC-001",
            severity: "error",
            message: "boom",
            path: "spec/index.ts",
          },
          {
            code: "TW-STYLE-001",
            severity: "warning",
            message: "camelCase please",
            hint: "rename 'get_thing' to 'getThing'",
          },
          {
            code: "TW-INFO-001",
            severity: "info",
            message: "fyi",
          },
        ],
      })
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[TW-SPEC-001] error spec/index.ts: boom")
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("[TW-STYLE-001] warning: camelCase please")
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("hint: rename 'get_thing' to 'getThing'")
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("[TW-INFO-001] info: fyi")
    );
  });
});

describe("reportValidationJson", () => {
  test("emits a stable JSON schema on stdout", () => {
    const write = vi.fn();
    const report = createReport();

    reportValidationJson({ write }, report);

    expect(write).toHaveBeenCalledTimes(1);
    const [payload] = write.mock.calls[0] ?? [];
    const parsed = JSON.parse(String(payload));

    expect(parsed).toEqual({
      version: REPORT_SCHEMA_VERSION,
      hasErrors: false,
      failOn: "error",
      stats: report.stats,
      issues: [],
      checks: report.checks,
    });
  });
});
