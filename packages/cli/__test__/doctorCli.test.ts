import { describe, expect, test, vi } from "vitest";

const { handleDoctorCommandMock } = vi.hoisted(() => ({
  handleDoctorCommandMock: vi.fn(),
}));

vi.mock("../src/commands/doctor.js", () => ({
  handleDoctorCommand: handleDoctorCommandMock,
}));

describe("doctor CLI wiring", () => {
  test("forwards doctor options and global flags to the handler", async () => {
    const { createCli } = await import("../src/cli.js");

    await createCli().parseAsync([
      "node",
      "typeweaver",
      "--verbose",
      "doctor",
      "--config",
      "./custom.config.mjs",
      "--deep",
    ]);

    expect(handleDoctorCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verbose: true,
        config: "./custom.config.mjs",
        deep: true,
      })
    );
  });
});
