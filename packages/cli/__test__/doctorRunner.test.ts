import { describe, expect, test } from "vitest";
import { runDoctorChecks } from "../src/doctor/runner.js";
import { createTestLogger } from "./__helpers__/testLogger.js";
import type { DoctorCheck, DoctorCheckContext } from "../src/doctor/types.js";

const createContext = (): DoctorCheckContext => {
  return {
    execDir: "/workspace",
    configPath: "/workspace/typeweaver.config.mjs",
    isDeep: true,
    logger: createTestLogger(),
    temporaryDirectory: "/tmp/typeweaver-doctor-test",
    state: {},
  };
};

describe("runDoctorChecks", () => {
  // Orchestration semantics (order, skip-cascade, summarizeChecks etc.) are
  // covered by `pipelineRunner.test.ts`. This file focuses on what
  // `runDoctorChecks` adds on top: routing thrown errors through the rich
  // diagnostic formatter so doctor results surface context lines and hints.
  test("renders thrown errors via the diagnostic formatter", async () => {
    const exploding: DoctorCheck = {
      id: "explosive",
      label: "Explosive",
      phase: "standard",
      run: async () => {
        throw new Error("Deep failure mode");
      },
    };

    const [result] = await runDoctorChecks([exploding], createContext());

    expect(result).toEqual(
      expect.objectContaining({
        id: "explosive",
        status: "fail",
        summary: "Deep failure mode",
      })
    );
  });
});
