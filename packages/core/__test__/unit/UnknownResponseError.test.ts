import { describe, expect, test } from "vitest";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";
import { ResponseValidationError } from "../../src/ResponseValidationError.js";
import { UnknownResponseError } from "../../src/UnknownResponse.js";

describe("UnknownResponseError", () => {
  const createError = (
    statusCode: HttpStatusCode = HttpStatusCode.IM_A_TEAPOT,
    header: Record<string, string> | undefined = {
      "Content-Type": "text/plain",
    },
    body: Record<string, unknown> = { detail: "unexpected" },
    validationError: ResponseValidationError = new ResponseValidationError(
      statusCode
    )
  ) => new UnknownResponseError(statusCode, header, body, validationError);

  test("stores statusCode from constructor", () => {
    const error = createError();
    expect(error.statusCode).toBe(HttpStatusCode.IM_A_TEAPOT);
  });

  test("stores header from constructor", () => {
    const header = { "Content-Type": "text/plain" };
    const error = createError(HttpStatusCode.IM_A_TEAPOT, header);
    expect(error.header).toBe(header);
  });

  test("stores body from constructor", () => {
    const body = { detail: "unexpected" };
    const error = createError(HttpStatusCode.IM_A_TEAPOT, undefined, body);
    expect(error.body).toBe(body);
  });

  test("stores validationError from constructor", () => {
    const validationError = new ResponseValidationError(
      HttpStatusCode.IM_A_TEAPOT
    );
    const error = createError(
      HttpStatusCode.IM_A_TEAPOT,
      undefined,
      {},
      validationError
    );
    expect(error.validationError).toBe(validationError);
  });

  test("message includes the status code", () => {
    const error = createError(HttpStatusCode.IM_A_TEAPOT);
    expect(error.message).toBe("Unknown response with status code '418'");
  });

  test("name property equals UnknownResponseError", () => {
    const error = createError();
    expect(error.name).toBe("UnknownResponseError");
  });

  test("is an instance of Error", () => {
    const error = createError();
    expect(error).toBeInstanceOf(Error);
  });

  test("works with undefined header", () => {
    const validationError = new ResponseValidationError(
      HttpStatusCode.NOT_FOUND
    );
    const error = new UnknownResponseError(
      HttpStatusCode.NOT_FOUND,
      undefined,
      { detail: "not found" },
      validationError
    );
    expect(error.header).toBeUndefined();
    expect(error.statusCode).toBe(HttpStatusCode.NOT_FOUND);
  });
});
