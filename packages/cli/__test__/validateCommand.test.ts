import { afterEach, describe, expect, test, vi } from "vitest";
import os from "node:os";
import { handleValidateCommand } from "../src/commands/validate.js";
import type { Logger } from "../src/logger.js";

const { loadSpecMock } = vi.hoisted(() => ({
  loadSpecMock: vi.fn(),
}));

vi.mock("../src/generators/specLoader.js", () => ({
  loadSpec: loadSpecMock,
}));

const createLogger = (): Logger => {
  return {
    isVerbose: false,
    debug: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    summary: vi.fn(),
  };
};

describe("handleValidateCommand", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("validates specs in a temporary directory and reports counts", async () => {
    loadSpecMock.mockResolvedValueOnce({
      normalizedSpec: {
        resources: [{ name: "todo", operations: [{ operationId: "getTodo" }] }],
        responses: [{ name: "Todo", kind: "response" }],
      },
    });
    const logger = createLogger();

    const summary = await handleValidateCommand(
      { input: "spec/index.ts" },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(loadSpecMock).toHaveBeenCalledWith({
      inputFile: "/workspace/spec/index.ts",
      specOutputDir: expect.stringMatching(
        new RegExp(`^${os.tmpdir().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/typeweaver-validate-.*?/spec$`)
      ),
    });
    expect(summary).toEqual(
      expect.objectContaining({
        mode: "validate",
        resourceCount: 1,
        operationCount: 1,
        responseCount: 1,
      })
    );
    expect(logger.summary).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "validate" })
    );
  });

  test("surfaces actionable diagnostics on validation failure", async () => {
    loadSpecMock.mockRejectedValueOnce(new Error("Bad spec"));
    const logger = createLogger();

    await handleValidateCommand(
      { input: "spec/index.ts" },
      {
        execDir: "/workspace",
        createLogger: () => logger,
      }
    );

    expect(logger.error).toHaveBeenCalledWith("Bad spec");
  });
});
