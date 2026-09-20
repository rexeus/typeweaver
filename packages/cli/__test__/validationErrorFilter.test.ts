import { Cause } from "effect";
import { CliError } from "effect/unstable/cli";
import { describe, expect, test } from "vitest";
import { MissingGenerateOptionError } from "../src/errors/MissingGenerateOptionError.js";
import { isOnlyValidationErrorCause } from "../src/validationErrorFilter.js";

const aValidationError = (): CliError.CliError =>
  new CliError.InvalidValue({
    option: "value",
    value: "",
    expected: "a value",
    kind: "flag",
  });

const aDomainError = (): MissingGenerateOptionError =>
  new MissingGenerateOptionError({
    optionName: "input",
    flag: "--input",
    configKey: "input",
  });

describe("isOnlyValidationErrorCause", () => {
  test("returns true when the cause is a Fail of a ValidationError", () => {
    const cause = Cause.fail(aValidationError());
    expect(isOnlyValidationErrorCause(cause)).toBe(true);
  });

  test("returns true when the cause is a Die carrying a ValidationError", () => {
    const cause = Cause.die(aValidationError());
    expect(isOnlyValidationErrorCause(cause)).toBe(true);
  });

  test("returns false when the cause is a Fail of a domain error", () => {
    const cause = Cause.fail(aDomainError());
    expect(isOnlyValidationErrorCause(cause)).toBe(false);
  });

  test("returns false when the cause carries both a ValidationError and a domain error", () => {
    const cause = Cause.combine(
      Cause.fail(aValidationError()),
      Cause.fail(aDomainError())
    );
    expect(isOnlyValidationErrorCause(cause)).toBe(false);
  });

  test("returns false when validation is combined with interruption", () => {
    const cause = Cause.combine(
      Cause.fail(aValidationError()),
      Cause.interrupt()
    );
    expect(isOnlyValidationErrorCause(cause)).toBe(false);
  });

  test("returns false for an empty cause (nothing to suppress)", () => {
    expect(isOnlyValidationErrorCause(Cause.empty)).toBe(false);
  });
});
