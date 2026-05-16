import { Cause } from "effect";
import { describe, expect, test } from "vitest";
import { MissingGenerateOptionError } from "../src/errors/MissingGenerateOptionError.js";
import { formatErrorForCli } from "../src/formatErrorForCli.js";

describe("formatErrorForCli", () => {
  test("returns the message of a plain Error", () => {
    expect(formatErrorForCli(new Error("boom"))).toBe("boom");
  });

  test("returns the rendered message of a tagged error", () => {
    const error = new MissingGenerateOptionError({
      optionName: "input",
      flag: "--input",
      configKey: "input",
    });

    expect(formatErrorForCli(error)).toBe(
      "Missing required generate option 'input'. Pass --input or set 'input' in the TypeWeaver config file."
    );
  });

  test("unwraps a Cause.fail wrapping a tagged error", () => {
    const error = new MissingGenerateOptionError({
      optionName: "output",
      flag: "--output",
      configKey: "output",
    });

    expect(formatErrorForCli(Cause.fail(error))).toBe(error.message);
  });

  test("renders Cause.die defects via their message", () => {
    expect(formatErrorForCli(Cause.die(new Error("kaboom")))).toBe("kaboom");
  });

  test("joins multiple failures in a Cause with newlines", () => {
    const a = new MissingGenerateOptionError({
      optionName: "input",
      flag: "--input",
      configKey: "input",
    });
    const b = new MissingGenerateOptionError({
      optionName: "output",
      flag: "--output",
      configKey: "output",
    });

    expect(formatErrorForCli(Cause.parallel(Cause.fail(a), Cause.fail(b)))).toBe(
      `${a.message}\n${b.message}`
    );
  });

  test("stringifies unknown non-Error values", () => {
    expect(formatErrorForCli(42)).toBe("42");
    expect(formatErrorForCli(null)).toBe("null");
    expect(formatErrorForCli({ key: "value" })).toBe("[object Object]");
  });
});
