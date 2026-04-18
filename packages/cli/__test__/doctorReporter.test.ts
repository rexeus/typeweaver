import { describe, expect, test, vi } from "vitest";
import { reportDoctorChecks } from "../src/doctor/reporter.js";
import { createLogger } from "../src/logger.js";
import type { DoctorCheckResult } from "../src/doctor/types.js";

const createStream = () => ({
  isTTY: false,
  write: vi.fn(),
});

const result = (
  overrides: Partial<DoctorCheckResult> & Pick<DoctorCheckResult, "status">
): DoctorCheckResult => ({
  id: "check",
  label: "Check",
  phase: "standard",
  summary: "summary",
  details: [],
  ...overrides,
});

describe("reportDoctorChecks", () => {
  test("renders standard and deep section headers and verbose details", () => {
    const stdout = createStream();
    const logger = createLogger({ verbose: true, stdout, stderr: stdout });

    reportDoctorChecks(logger, [
      result({
        id: "runtime",
        label: "Runtime detection",
        status: "pass",
        summary: "Node.js detected.",
        details: ["v22.0.0"],
      }),
      result({
        id: "bundle",
        label: "Spec bundle",
        phase: "deep",
        status: "skip",
        summary: "Skipped because 'Input path' did not pass.",
      }),
    ]);

    expect(stdout.write).toHaveBeenCalledWith("→ Standard checks\n");
    expect(stdout.write).toHaveBeenCalledWith(
      "✔ Runtime detection: Node.js detected.\n"
    );
    expect(stdout.write).toHaveBeenCalledWith("  v22.0.0\n");
    expect(stdout.write).toHaveBeenCalledWith("→ Deep checks\n");
    expect(stdout.write).toHaveBeenCalledWith(
      "○ Spec bundle: Skipped because 'Input path' did not pass.\n"
    );
  });

  test("routes warn and fail results through the appropriate logger channels", () => {
    const stdout = createStream();
    const stderr = createStream();
    const logger = createLogger({ stdout, stderr });

    reportDoctorChecks(logger, [
      result({
        id: "formatter",
        label: "Formatter",
        status: "warn",
        summary: "oxfmt not installed.",
      }),
      result({
        id: "config",
        label: "Config",
        status: "fail",
        summary: "Config missing.",
      }),
    ]);

    expect(stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("Formatter: oxfmt not installed.")
    );
    expect(stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("Config: Config missing.")
    );
  });

  test("omits details outside of verbose mode", () => {
    const stdout = createStream();
    const logger = createLogger({ stdout, stderr: stdout });

    reportDoctorChecks(logger, [
      result({
        status: "pass",
        summary: "All good.",
        details: ["detail line 1", "detail line 2"],
      }),
    ]);

    const written = stdout.write.mock.calls.map(call => String(call[0]));
    expect(written).not.toContain("  detail line 1\n");
    expect(written).not.toContain("  detail line 2\n");
  });

  test("skips phase headers when the corresponding phase has no results", () => {
    const stdout = createStream();
    const logger = createLogger({ stdout, stderr: stdout });

    reportDoctorChecks(logger, [
      result({
        phase: "deep",
        status: "pass",
        summary: "Deep check only.",
      }),
    ]);

    const written = stdout.write.mock.calls.map(call => String(call[0]));
    expect(written).toContain("→ Deep checks\n");
    expect(written).not.toContain("→ Standard checks\n");
  });

  test("produces no output for an empty result set", () => {
    const stdout = createStream();
    const logger = createLogger({ stdout, stderr: stdout });

    reportDoctorChecks(logger, []);

    expect(stdout.write).not.toHaveBeenCalled();
  });
});
