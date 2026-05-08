import { describe, expect, expectTypeOf, test } from "vitest";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import { ResponseValidationError } from "../../src/ResponseValidationError.js";
import type { InvalidStatusCodeIssue } from "../../src/ResponseValidationError.js";

describe("ResponseValidationError", () => {
  test("preserves malformed status code diagnostics for error handling", () => {
    const expectedStatusCodes = [
      HttpStatusCode.CREATED,
      HttpStatusCode.BAD_REQUEST,
    ];
    const error = new ResponseValidationError("201");

    error.addStatusCodeIssue(expectedStatusCodes);

    expect(error.statusCode).toBe("201");
    expect(error.issues).toEqual([
      {
        type: "INVALID_STATUS_CODE",
        invalidStatusCode: "201",
        expectedStatusCodes,
      },
    ]);
  });

  test("constructs with a symbol status code and preserves the raw diagnostic", () => {
    const statusCode = Symbol("201");
    const expectedStatusCodes = [HttpStatusCode.CREATED];
    const error = new ResponseValidationError(statusCode);

    error.addStatusCodeIssue(expectedStatusCodes);

    expect(error.statusCode).toBe(statusCode);
    expect(error.issues).toEqual([
      {
        type: "INVALID_STATUS_CODE",
        invalidStatusCode: statusCode,
        expectedStatusCodes,
      },
    ]);
  });

  test("constructs with a hostile object status code and preserves the raw diagnostic", () => {
    const statusCode = {
      [Symbol.toPrimitive]: () => {
        throw new Error("status code coercion should not run");
      },
      toString: () => {
        throw new Error("status code stringification should not run");
      },
    };
    const expectedStatusCodes = [HttpStatusCode.CREATED];
    const error = new ResponseValidationError(statusCode);

    error.addStatusCodeIssue(expectedStatusCodes);

    expect(error.statusCode).toBe(statusCode);
    expect(error.issues).toEqual([
      {
        type: "INVALID_STATUS_CODE",
        invalidStatusCode: statusCode,
        expectedStatusCodes,
      },
    ]);
  });

  test("keeps malformed status diagnostics wide while expected statuses stay typed", () => {
    expectTypeOf<
      ResponseValidationError["statusCode"]
    >().toEqualTypeOf<unknown>();
    expectTypeOf<
      InvalidStatusCodeIssue["invalidStatusCode"]
    >().toEqualTypeOf<unknown>();
    expectTypeOf<InvalidStatusCodeIssue["expectedStatusCodes"]>().toEqualTypeOf<
      HttpStatusCode[]
    >();
  });
});
