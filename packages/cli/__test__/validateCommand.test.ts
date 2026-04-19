import os from "node:os";
import { afterEach, describe, expect, test, vi } from "vitest";
import { handleValidateCommand } from "../src/commands/validate.js";
import { createTestLogger } from "./__helpers__/testLogger.js";

const { loadSpecMock } = vi.hoisted(() => ({
  loadSpecMock: vi.fn(),
}));

vi.mock("../src/generators/specLoader.js", () => ({
  loadSpec: loadSpecMock,
}));

const mockCleanSpec = (): void => {
  loadSpecMock.mockResolvedValueOnce({
    normalizedSpec: {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "getTodo",
              method: "GET",
              path: "/todos/{todoId}",
            },
          ],
        },
      ],
      responses: [{ name: "Todo", kind: "response" }],
    },
  });
};

const mockSpecWithStyleViolation = (): void => {
  loadSpecMock.mockResolvedValueOnce({
    normalizedSpec: {
      resources: [
        {
          name: "todo",
          operations: [
            {
              operationId: "Get_Todo",
              method: "GET",
              path: "/todos",
            },
          ],
        },
      ],
      responses: [],
    },
  });
};

describe("handleValidateCommand", () => {
  afterEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  test("produces a clean ValidationReport for a well-formed spec", async () => {
    mockCleanSpec();
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      { input: "spec/index.ts" },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(loadSpecMock).toHaveBeenCalledWith({
      inputFile: "/workspace/spec/index.ts",
      specOutputDir: expect.stringMatching(
        new RegExp(
          `^${os.tmpdir().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/typeweaver-validate-.*?/spec$`
        )
      ),
    });
    expect(report).toBeDefined();
    expect(report?.hasErrors).toBe(false);
    expect(report?.stats).toEqual(
      expect.objectContaining({
        errors: 0,
        warnings: 0,
        resources: 1,
        operations: 1,
        responses: 1,
      })
    );
    expect(report?.issues).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });

  test("reports spec load failures as TW-SPEC-001 issues with exit code 1", async () => {
    loadSpecMock.mockRejectedValueOnce(new Error("Bad spec"));
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      { input: "spec/index.ts" },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(report?.hasErrors).toBe(true);
    expect(report?.issues).toEqual([
      expect.objectContaining({
        code: "TW-SPEC-001",
        severity: "error",
        message: expect.stringContaining("Bad spec"),
      }),
    ]);
    expect(logger.error).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("fails with a clear error when no input is provided", async () => {
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      {},
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(report).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("No input spec entrypoint provided")
    );
    expect(process.exitCode).toBe(1);
    expect(loadSpecMock).not.toHaveBeenCalled();
  });

  test("rejects an invalid --fail-on value with an explanatory error", async () => {
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      { input: "spec/index.ts", failOn: "catastrophic" },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(report).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid --fail-on value 'catastrophic'")
    );
    expect(process.exitCode).toBe(1);
  });

  test("reports rule violations from enabled style checks", async () => {
    mockSpecWithStyleViolation();
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      {
        input: "spec/index.ts",
        enable: "TW-STYLE-001",
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(report?.issues).toContainEqual(
      expect.objectContaining({
        code: "TW-STYLE-001",
        severity: "warning",
        message: expect.stringContaining("Get_Todo"),
      })
    );
    expect(report?.stats.warnings).toBeGreaterThan(0);
    // Warnings don't fail by default.
    expect(report?.hasErrors).toBe(false);
    expect(process.exitCode).toBeUndefined();
  });

  test("--strict promotes warnings to errors and fails the run", async () => {
    mockSpecWithStyleViolation();
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      {
        input: "spec/index.ts",
        enable: "TW-STYLE-001",
        strict: true,
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(report?.issues[0]?.severity).toBe("error");
    expect(report?.hasErrors).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  test("--disable silences specific rule codes", async () => {
    loadSpecMock.mockRejectedValueOnce(new Error("Bad spec"));
    const logger = createTestLogger();

    const report = await handleValidateCommand(
      {
        input: "spec/index.ts",
        disable: "TW-SPEC-001",
      },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(report?.issues).toEqual([]);
    expect(report?.hasErrors).toBe(false);
    expect(process.exitCode).toBeUndefined();
  });

  test("emits a JSON report on stdout when --json is set", async () => {
    mockCleanSpec();
    const logger = createTestLogger();
    const writeMock = vi.fn();

    const report = await handleValidateCommand(
      { input: "spec/index.ts", json: true },
      {
        execDir: "/workspace",
        createLogger: () => logger,
        stdout: { write: writeMock },
      }
    );

    expect(report).toBeDefined();
    expect(writeMock).toHaveBeenCalledTimes(1);
    const [payload] = writeMock.mock.calls[0] ?? [];
    const parsed = JSON.parse(String(payload));
    expect(parsed).toEqual(
      expect.objectContaining({
        version: "1",
        hasErrors: false,
        failOn: "error",
        stats: expect.objectContaining({ errors: 0 }),
        issues: expect.any(Array),
        checks: expect.any(Array),
      })
    );
    expect(logger.step).not.toHaveBeenCalled();
  });
});
