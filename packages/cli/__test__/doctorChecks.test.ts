import { describe, expect, test, vi } from "vitest";
import { createDoctorChecks } from "../src/doctor/checks.js";
import { runDoctorChecks } from "../src/doctor/runner.js";
import type { DoctorCheckContext } from "../src/doctor/types.js";

const { isFormatterAvailableMock } = vi.hoisted(() => ({
  isFormatterAvailableMock: vi.fn(),
}));

vi.mock("../src/generators/formatter.js", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/generators/formatter.js")>();

  return {
    ...actual,
    isFormatterAvailable: isFormatterAvailableMock,
  };
});

const createContext = (
  overrides: Partial<DoctorCheckContext> = {}
): DoctorCheckContext => {
  return {
    execDir: "/workspace/project",
    configPath: "/workspace/project/typeweaver.config.mjs",
    isDeep: false,
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
    state: {
      loadedConfig: {
        input: "./spec/index.ts",
        output: "./generated",
        format: false,
      },
    },
    ...overrides,
  };
};

describe("doctor checks", () => {
  test("marks dangerous output paths as failures", async () => {
    const outputSafetyCheck = createDoctorChecks(false).find(
      check => check.id === "output-safety"
    );

    expect(outputSafetyCheck).toBeDefined();

    const [result] = await runDoctorChecks(
      [outputSafetyCheck!],
      createContext({
        state: {
          loadedConfig: {
            input: "./spec/index.ts",
            output: ".",
            clean: true,
          },
        },
      })
    );

    expect(result?.status).toBe("fail");
    expect(result?.summary).toContain("current working directory");
  });

  test("treats formatter availability as passing when formatting is disabled", async () => {
    const formatterCheck = createDoctorChecks(false).find(
      check => check.id === "formatter-availability"
    );

    expect(formatterCheck).toBeDefined();

    const outcome = await formatterCheck!.run(createContext());

    expect(outcome.result).toEqual(
      expect.objectContaining({
        status: "pass",
        summary: "Formatting is disabled in config.",
      })
    );
  });

  test("warns when formatting is enabled but oxfmt is unavailable", async () => {
    const formatterCheck = createDoctorChecks(false).find(
      check => check.id === "formatter-availability"
    );

    expect(formatterCheck).toBeDefined();
    isFormatterAvailableMock.mockResolvedValueOnce(false);

    const outcome = await formatterCheck!.run(
      createContext({
        state: {
          loadedConfig: {
            input: "./spec/index.ts",
            output: "./generated",
            format: true,
          },
        },
      })
    );

    expect(outcome.result).toEqual(
      expect.objectContaining({
        status: "warn",
        summary: "oxfmt is not installed; generated code will not be formatted.",
      })
    );
  });

  test("fails clearly when the config is missing an input path", async () => {
    const inputCheck = createDoctorChecks(false).find(
      check => check.id === "input-exists"
    );

    expect(inputCheck).toBeDefined();

    const outcome = await inputCheck!.run(
      createContext({
        state: {
          loadedConfig: {
            output: "./generated",
          },
        },
      })
    );

    expect(outcome.result).toEqual(
      expect.objectContaining({
        status: "fail",
        summary: "Config is missing an input spec entrypoint.",
      })
    );
  });

  test("fails deep spec import checks clearly when bundle state is unexpectedly missing", async () => {
    const specImportCheck = createDoctorChecks(true).find(
      check => check.id === "spec-import-shape"
    );

    expect(specImportCheck).toBeDefined();

    const outcome = await specImportCheck!.run(createContext({ isDeep: true }));

    expect(outcome.result).toEqual(
      expect.objectContaining({
        status: "fail",
        summary:
          "Cannot import the bundled spec because the bundle output path is unavailable after prerequisite checks.",
      })
    );
  });
});
