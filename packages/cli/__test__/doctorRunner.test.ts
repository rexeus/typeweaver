import { describe, expect, test } from "vitest";
import { runDoctorChecks, summarizeDoctorChecks } from "../src/doctor/runner.js";
import type { DoctorCheck, DoctorCheckContext } from "../src/doctor/types.js";

const createContext = (): DoctorCheckContext => {
  return {
    execDir: "/workspace",
    configPath: "/workspace/typeweaver.config.mjs",
    isDeep: true,
    logger: {
      isVerbose: false,
      debug: () => {},
      info: () => {},
      success: () => {},
      warn: () => {},
      error: () => {},
      step: () => {},
      summary: () => {},
    },
    temporaryDirectory: "/tmp/typeweaver-doctor-test",
    state: {},
  };
};

describe("doctor runner", () => {
  test("runs checks in order and cascades skips from failed prerequisites", async () => {
    const executionOrder: string[] = [];
    const checks: readonly DoctorCheck[] = [
      {
        id: "first",
        label: "First",
        phase: "standard",
        run: async () => {
          executionOrder.push("first");

          return {
            result: {
              id: "first",
              label: "First",
              phase: "standard",
              status: "fail",
              summary: "nope",
              details: [],
            },
          };
        },
      },
      {
        id: "second",
        label: "Second",
        phase: "standard",
        dependsOn: ["first"],
        run: async () => {
          executionOrder.push("second");

          return {
            result: {
              id: "second",
              label: "Second",
              phase: "standard",
              status: "pass",
              summary: "ok",
              details: [],
            },
          };
        },
      },
      {
        id: "third",
        label: "Third",
        phase: "deep",
        run: async () => {
          executionOrder.push("third");

          return {
            result: {
              id: "third",
              label: "Third",
              phase: "deep",
              status: "pass",
              summary: "ok",
              details: [],
            },
          };
        },
      },
    ];

    const results = await runDoctorChecks(checks, createContext());

    expect(executionOrder).toEqual(["first", "third"]);
    expect(results.map(result => result.status)).toEqual(["fail", "skip", "pass"]);
    expect(results[1]).toEqual(
      expect.objectContaining({
        summary: "Skipped because 'First' did not pass.",
      })
    );
  });

  test("summarizes pass warn fail and skip counts", () => {
    const summary = summarizeDoctorChecks([
      {
        id: "pass",
        label: "Pass",
        phase: "standard",
        status: "pass",
        summary: "ok",
        details: [],
      },
      {
        id: "warn",
        label: "Warn",
        phase: "standard",
        status: "warn",
        summary: "careful",
        details: [],
      },
      {
        id: "fail",
        label: "Fail",
        phase: "deep",
        status: "fail",
        summary: "broken",
        details: [],
      },
      {
        id: "skip",
        label: "Skip",
        phase: "deep",
        status: "skip",
        summary: "skipped",
        details: [],
      },
    ]);

    expect(summary).toEqual({
      totalChecks: 4,
      passedChecks: 1,
      warnedChecks: 1,
      failedChecks: 1,
      skippedChecks: 1,
      hasFailures: true,
    });
  });
});
