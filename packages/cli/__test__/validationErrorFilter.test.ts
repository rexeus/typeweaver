import { HelpDoc, ValidationError } from "@effect/cli";
import { Cause } from "effect";
import { describe, expect, test } from "vitest";
import { MissingGenerateOptionError } from "../src/errors/MissingGenerateOptionError.js";
import { isOnlyValidationErrorCause } from "../src/validationErrorFilter.js";

const aValidationError = (): ValidationError.ValidationError =>
  ValidationError.invalidValue(HelpDoc.p("expected a value"));

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
    const cause = Cause.parallel(
      Cause.fail(aValidationError()),
      Cause.fail(aDomainError())
    );
    expect(isOnlyValidationErrorCause(cause)).toBe(false);
  });

  test("returns false for an empty cause (nothing to suppress)", () => {
    expect(isOnlyValidationErrorCause(Cause.empty)).toBe(false);
  });
});
