import fs from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("version module", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  test("getCliVersion returns the version from the CLI package.json", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        name: "@rexeus/typeweaver",
        version: "9.9.9",
        description: "test",
      })
    );

    const { getCliVersion } = await import("../src/version.js");

    expect(getCliVersion()).toBe("9.9.9");
  });

  test("getCliPackageJson exposes the full name, version and description", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        name: "@rexeus/typeweaver",
        version: "1.2.3",
        description: "Type-safe API framework",
      })
    );

    const { getCliPackageJson } = await import("../src/version.js");

    expect(getCliPackageJson()).toEqual({
      name: "@rexeus/typeweaver",
      version: "1.2.3",
      description: "Type-safe API framework",
    });
  });

  test("reads the package.json exactly once across repeated calls", async () => {
    const readSpy = vi.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        name: "@rexeus/typeweaver",
        version: "1.2.3",
        description: "test",
      })
    );

    const { getCliVersion, getCliPackageJson } =
      await import("../src/version.js");

    getCliVersion();
    getCliVersion();
    getCliPackageJson();

    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  test("propagates ENOENT when the package.json cannot be read", async () => {
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw Object.assign(
        new Error("ENOENT: no such file or directory, open 'package.json'"),
        { code: "ENOENT" }
      );
    });

    const { getCliVersion } = await import("../src/version.js");

    expect(() => getCliVersion()).toThrow(/ENOENT/);
  });

  test("propagates SyntaxError when the package.json is malformed", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue("{ not valid json");

    const { getCliVersion } = await import("../src/version.js");

    expect(() => getCliVersion()).toThrow(SyntaxError);
  });
});
