import { describe, expect, test } from "vitest";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import { ResponseValidationError } from "../../src/ResponseValidationError.js";
import { UnknownResponseError } from "../../src/UnknownResponse.js";

const aValidationErrorFor = (statusCode: HttpStatusCode) => {
  return new ResponseValidationError(statusCode);
};

type UnknownResponseErrorOptions = {
  readonly statusCode?: HttpStatusCode;
  readonly header?: Record<string, string> | undefined;
  readonly body?: Record<string, unknown> | undefined;
  readonly validationError?: ResponseValidationError;
};

const hasOwnOption = (
  options: UnknownResponseErrorOptions,
  property: keyof UnknownResponseErrorOptions
) => {
  return Object.prototype.hasOwnProperty.call(options, property);
};

const anUnknownResponseError = (options: UnknownResponseErrorOptions = {}) => {
  const statusCode = options.statusCode ?? HttpStatusCode.IM_A_TEAPOT;
  const header = hasOwnOption(options, "header")
    ? options.header
    : { "Content-Type": "text/plain" };
  const body = hasOwnOption(options, "body")
    ? options.body
    : { detail: "unexpected" };
  const validationError =
    options.validationError ?? aValidationErrorFor(statusCode);

  return new UnknownResponseError(statusCode, header, body, validationError);
};

describe("UnknownResponseError", () => {
  test("preserves the unknown response payload for error handling", () => {
    const header = { "Content-Type": "application/json" };
    const body = { code: "unexpected_response" };
    const validationError = aValidationErrorFor(
      HttpStatusCode.INTERNAL_SERVER_ERROR
    );

    const error = anUnknownResponseError({
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      header,
      body,
      validationError,
    });

    expect(error.statusCode).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
    expect(error.header).toBe(header);
    expect(error.body).toBe(body);
    expect(error.validationError).toBe(validationError);
  });

  test("uses a stable explicit diagnostic message", () => {
    const error = anUnknownResponseError({
      statusCode: HttpStatusCode.IM_A_TEAPOT,
    });

    expect(error.message).toBe("Unknown response with status code '418'");
  });

  test("identifies itself as an UnknownResponseError", () => {
    const error = anUnknownResponseError();

    expect(error.name).toBe("UnknownResponseError");
  });

  test("inherits from Error for catch-boundary compatibility", () => {
    const error = anUnknownResponseError();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UnknownResponseError);
  });

  test("captures an Error stack for diagnostics", () => {
    const error = anUnknownResponseError();

    expect(error.stack).toEqual(expect.any(String));
  });

  test("preserves absent optional header and body payloads", () => {
    const validationError = aValidationErrorFor(HttpStatusCode.NOT_FOUND);

    const error = anUnknownResponseError({
      statusCode: HttpStatusCode.NOT_FOUND,
      header: undefined,
      body: undefined,
      validationError,
    });

    expect(error.header).toBeUndefined();
    expect(error.body).toBeUndefined();
    expect(error.validationError).toBe(validationError);
  });
});
