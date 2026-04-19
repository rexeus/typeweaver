import { describe, expect, test } from "vitest";
import { createCheckHelpers } from "../src/validate/checks/support.js";
import type { IssueSeverity } from "../src/validate/types.js";

const IDENTITY = { id: "test/check", label: "Test check" } as const;

const resolver = {
  resolveSeverity: (issue: { severity: IssueSeverity }) => issue.severity,
};

describe("createCheckHelpers", () => {
  test("binds identity so pass/warn/fail produce results with the check id and label", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const passed = helpers.pass("ok");
    const warned = helpers.warn("watch");
    const failed = helpers.fail("broken");

    expect(passed.result).toEqual(
      expect.objectContaining({
        id: "test/check",
        label: "Test check",
        status: "pass",
        summary: "ok",
      })
    );
    expect(warned.result).toEqual(
      expect.objectContaining({ status: "warn", summary: "watch" })
    );
    expect(failed.result).toEqual(
      expect.objectContaining({ status: "fail", summary: "broken" })
    );
  });

  test("finalize produces fail when any error-severity issue is present", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const outcome = helpers.finalize(
      [
        { code: "X", severity: "error", message: "bad" },
        { code: "Y", severity: "warning", message: "meh" },
      ],
      resolver,
      {
        pass: "ok",
        warn: count => `${count} warnings`,
        fail: count => `${count} errors`,
      }
    );

    expect(outcome.result.status).toBe("fail");
    expect(outcome.result.summary).toBe("1 errors");
  });

  test("finalize produces warn when only warning-severity issues are present", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const outcome = helpers.finalize(
      [
        { code: "X", severity: "warning", message: "a" },
        { code: "Y", severity: "warning", message: "b" },
      ],
      resolver,
      {
        pass: "clean",
        warn: count => `${count} warns`,
        fail: count => `${count} fails`,
      }
    );

    expect(outcome.result.status).toBe("warn");
    expect(outcome.result.summary).toBe("2 warns");
  });

  test("finalize uses the info message when only info-severity issues are present", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const outcome = helpers.finalize(
      [
        { code: "X", severity: "info", message: "note" },
        { code: "Y", severity: "info", message: "another" },
      ],
      resolver,
      {
        pass: "nothing to report",
        warn: count => `${count} warns`,
        fail: count => `${count} fails`,
        info: count => `${count} notes observed`,
      }
    );

    expect(outcome.result.status).toBe("pass");
    expect(outcome.result.summary).toBe("2 notes observed");
  });

  test("finalize falls back to the default pass message when no info handler is provided", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const outcome = helpers.finalize(
      [{ code: "X", severity: "info", message: "note" }],
      resolver,
      {
        pass: "all clear",
        warn: count => `${count} warns`,
        fail: count => `${count} fails`,
      }
    );

    expect(outcome.result.status).toBe("pass");
    expect(outcome.result.summary).toBe("all clear");
  });

  test("finalize returns the default pass message when no issues are present", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const outcome = helpers.finalize([], resolver, {
      pass: "all clear",
      warn: count => `${count} warns`,
      fail: count => `${count} fails`,
    });

    expect(outcome.result.status).toBe("pass");
    expect(outcome.result.summary).toBe("all clear");
  });

  test("finalize threads the state through the outcome", () => {
    const helpers = createCheckHelpers(IDENTITY);

    const outcome = helpers.finalize([], resolver, {
      pass: "ok",
      warn: count => `${count}`,
      fail: count => `${count}`,
    });

    expect(outcome.state).toBeUndefined();
  });
});
