import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  handleDoctorCommandMock,
  handleGenerateCommandMock,
  handleInitCommandMock,
  handleMigrateCommandMock,
  handleValidateCommandMock,
} = vi.hoisted(() => ({
  handleDoctorCommandMock: vi.fn(),
  handleGenerateCommandMock: vi.fn(),
  handleInitCommandMock: vi.fn(),
  handleMigrateCommandMock: vi.fn(),
  handleValidateCommandMock: vi.fn(),
}));

vi.mock("../src/commands/doctor.js", () => ({
  handleDoctorCommand: handleDoctorCommandMock,
}));
vi.mock("../src/commands/generate.js", () => ({
  handleGenerateCommand: handleGenerateCommandMock,
}));
vi.mock("../src/commands/init.js", () => ({
  handleInitCommand: handleInitCommandMock,
}));
vi.mock("../src/commands/migrate.js", () => ({
  handleMigrateCommand: handleMigrateCommandMock,
}));
vi.mock("../src/commands/validate.js", () => ({
  handleValidateCommand: handleValidateCommandMock,
}));

const loadCli = async () => (await import("../src/cli.js")).createCli();

const run = async (...args: string[]): Promise<void> => {
  const cli = await loadCli();
  await cli.parseAsync(["node", "typeweaver", ...args]);
};

describe("CLI wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("forwards doctor options and global flags to the handler", async () => {
    await run(
      "--verbose",
      "doctor",
      "--config",
      "./custom.config.mjs",
      "--deep"
    );

    expect(handleDoctorCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verbose: true,
        config: "./custom.config.mjs",
        deep: true,
      })
    );
  });

  test("forwards generate options and global flags to the handler", async () => {
    await run(
      "--quiet",
      "generate",
      "--input",
      "./spec/index.ts",
      "--output",
      "./generated",
      "--plugins",
      "clients,hono",
      "--dry-run"
    );

    expect(handleGenerateCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        quiet: true,
        input: "./spec/index.ts",
        output: "./generated",
        plugins: "clients,hono",
        dryRun: true,
      })
    );
  });

  test("forwards validate options and global flags to the handler", async () => {
    await run(
      "validate",
      "--config",
      "./typeweaver.config.mjs",
      "--strict",
      "--fail-on",
      "warning",
      "--disable",
      "TW-STYLE-001",
      "--json"
    );

    expect(handleValidateCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: "./typeweaver.config.mjs",
        strict: true,
        failOn: "warning",
        disable: "TW-STYLE-001",
        json: true,
      })
    );
  });

  test("forwards init options and global flags to the handler", async () => {
    await run(
      "init",
      "--output",
      "./generated",
      "--plugins",
      "clients",
      "--force",
      "--config-format",
      "cjs"
    );

    expect(handleInitCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "./generated",
        plugins: "clients",
        force: true,
        configFormat: "cjs",
      })
    );
  });

  test("forwards migrate options and global flags to the handler", async () => {
    await run("migrate", "--from", "0.7.12");

    expect(handleMigrateCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "0.7.12",
      })
    );
  });

  test("rejects combining --verbose with --quiet before any command runs", async () => {
    const cli = await loadCli();
    cli.exitOverride();
    cli.configureOutput({
      writeOut: () => {},
      writeErr: () => {},
    });

    await expect(
      cli.parseAsync(["node", "typeweaver", "--verbose", "--quiet", "doctor"])
    ).rejects.toThrow(/option.+cannot be used with option/iu);

    expect(handleDoctorCommandMock).not.toHaveBeenCalled();
  });
});
