import path from "node:path";
import { describe, expect, test } from "vitest";
import { MissingGenerateOptionError } from "../src/errors/MissingGenerateOptionError.js";
import { resolveGenerateOptions } from "../src/resolveGenerateOptions.js";

const captureError = (action: () => void): unknown => {
  try {
    action();
  } catch (error) {
    return error;
  }

  return undefined;
};

describe("resolveGenerateOptions", () => {
  const workspacePath = path.join(path.parse(process.cwd()).root, "workspace");

  test("resolves generate options from config when CLI flags are omitted", () => {
    const options = resolveGenerateOptions(
      {},
      {
        input: "./spec.ts",
        output: "./generated",
        plugins: ["clients"],
        format: false,
        clean: false,
      },
      workspacePath
    );

    expect(options.inputPath).toBe(path.join(workspacePath, "spec.ts"));
    expect(options.outputDir).toBe(path.join(workspacePath, "generated"));
    expect(options.config).toEqual({
      input: path.join(workspacePath, "spec.ts"),
      output: path.join(workspacePath, "generated"),
      plugins: ["clients"],
      format: false,
      clean: false,
    });
  });

  test("uses CLI flags over config values while preserving explicit false booleans", () => {
    const options = resolveGenerateOptions(
      {
        input: "./cli-spec.ts",
        output: "./cli-generated",
        format: false,
        clean: false,
      },
      {
        input: "./config-spec.ts",
        output: "./config-generated",
        format: true,
        clean: true,
      },
      workspacePath
    );

    expect(options.inputPath).toBe(path.join(workspacePath, "cli-spec.ts"));
    expect(options.outputDir).toBe(path.join(workspacePath, "cli-generated"));
    expect(options.config).toEqual(
      expect.objectContaining({
        input: path.join(workspacePath, "cli-spec.ts"),
        output: path.join(workspacePath, "cli-generated"),
        format: false,
        clean: false,
      })
    );
  });

  test("uses trimmed CLI plugin entries over config plugins", () => {
    const options = resolveGenerateOptions(
      {
        input: "./spec.ts",
        output: "./generated",
        plugins: "clients, hono ,server",
      },
      { plugins: ["config-plugin"] },
      workspacePath
    );

    expect(options.config.plugins).toEqual(["clients", "hono", "server"]);
  });

  test("rejects missing input with option diagnostics", () => {
    const error = captureError(() =>
      resolveGenerateOptions({ output: "./generated" }, {}, "/workspace")
    );

    expect(error).toBeInstanceOf(MissingGenerateOptionError);
    expect(error).toEqual(
      expect.objectContaining({
        optionName: "input",
        flag: "--input",
        configKey: "input",
      })
    );
  });

  test("rejects missing output with option diagnostics", () => {
    const error = captureError(() =>
      resolveGenerateOptions({ input: "./spec.ts" }, {}, "/workspace")
    );

    expect(error).toBeInstanceOf(MissingGenerateOptionError);
    expect(error).toEqual(
      expect.objectContaining({
        optionName: "output",
        flag: "--output",
        configKey: "output",
      })
    );
  });
});
