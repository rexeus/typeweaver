import { describe, expect, test, vi } from "vitest";
import { reportCheckSection } from "../src/pipeline/reporting.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type { BaseCheckResult } from "../src/pipeline/types.js";

const makeResult = (
  overrides: Partial<BaseCheckResult> & Pick<BaseCheckResult, "status">
): BaseCheckResult => ({
  id: overrides.id ?? "check",
  label: overrides.label ?? "Check",
  summary: overrides.summary ?? "summary line",
  details: overrides.details ?? [],
  ...overrides,
});

describe("reportCheckSection", () => {
  test("emits nothing for empty results", () => {
    const logger = createTestLogger();

    reportCheckSection(logger, "Empty", []);

    expect(logger.step).not.toHaveBeenCalled();
    expect(logger.success).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("routes each status to the matching logger channel", () => {
    const logger = createTestLogger();

    reportCheckSection(logger, "Section", [
      makeResult({ status: "pass", label: "A", summary: "ok" }),
      makeResult({ status: "warn", label: "B", summary: "meh" }),
      makeResult({ status: "fail", label: "C", summary: "boom" }),
      makeResult({ status: "skip", label: "D", summary: "later" }),
    ]);

    expect(logger.step).toHaveBeenCalledWith("Section");
    expect(logger.success).toHaveBeenCalledWith("A: ok");
    expect(logger.warn).toHaveBeenCalledWith("B: meh");
    expect(logger.error).toHaveBeenCalledWith("C: boom");
    expect(logger.info).toHaveBeenCalledWith("○ D: later");
  });

  test("suppresses details entirely when logger is not verbose", () => {
    const logger = createTestLogger();

    reportCheckSection(logger, "Section", [
      makeResult({
        status: "pass",
        summary: "ok",
        details: ["extra-1", "extra-2"],
      }),
    ]);

    // A `pass` result routes only to `success`; `info` must never fire when
    // details are suppressed, regardless of the detail contents.
    expect(logger.info).not.toHaveBeenCalled();
  });

  test("emits every detail with two-space indent in verbose mode", () => {
    const logger = { ...createTestLogger(), isVerbose: true };

    reportCheckSection(logger, "Section", [
      makeResult({
        status: "warn",
        summary: "almost",
        details: ["note-1", "note-2"],
      }),
    ]);

    expect(logger.info).toHaveBeenCalledWith("  note-1");
    expect(logger.info).toHaveBeenCalledWith("  note-2");
  });

  test("uses info + ○ glyph for skip — not success/warn/error", () => {
    const logger = createTestLogger();

    reportCheckSection(logger, "Section", [
      makeResult({ status: "skip", label: "Deep", summary: "not requested" }),
    ]);

    expect(logger.info).toHaveBeenCalledWith("○ Deep: not requested");
    expect(logger.success).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
