import { describe, expect, test, vi } from "vitest";
import { createLogger } from "../src/logger.js";
import { reportDoctorChecks } from "../src/doctor/reporter.js";

describe("doctor reporter", () => {
  test("renders standard and deep sections with details in verbose mode", () => {
    const stdout = { isTTY: false, write: vi.fn() };
    const logger = createLogger({ verbose: true, stdout, stderr: stdout });

    reportDoctorChecks(logger, [
      {
        id: "runtime",
        label: "Runtime detection",
        phase: "standard",
        status: "pass",
        summary: "Node.js detected.",
        details: ["v22.0.0"],
      },
      {
        id: "bundle",
        label: "Spec bundle",
        phase: "deep",
        status: "skip",
        summary: "Skipped because 'Input path' did not pass.",
        details: [],
      },
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
});
