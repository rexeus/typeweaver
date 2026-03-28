import { describe, expect, expectTypeOf, test } from "vitest";
import {
  badRequestDefaultError,
  createDefaultErrorBody,
  createDefaultErrorResponse,
  defaultErrorDescriptors,
  forbiddenDefaultError,
  internalServerErrorDefaultError,
  methodNotAllowedDefaultError,
  notFoundDefaultError,
  payloadTooLargeDefaultError,
  unauthorizedDefaultError,
  validationDefaultError,
} from "../../src/defaultError";
import { HttpStatusCode } from "../../src/HttpStatusCode";

describe("defaultError", () => {
  test("covers all current framework default errors", () => {
    expect(defaultErrorDescriptors).toEqual({
      badRequest: {
        statusCode: HttpStatusCode.BAD_REQUEST,
        code: "BAD_REQUEST",
        message: "Malformed request body",
      },
      validation: {
        statusCode: HttpStatusCode.BAD_REQUEST,
        code: "VALIDATION_ERROR",
        message: "Invalid request",
      },
      unauthorized: {
        statusCode: HttpStatusCode.UNAUTHORIZED,
        code: "UNAUTHORIZED_ERROR",
        message: "Unauthorized request",
      },
      forbidden: {
        statusCode: HttpStatusCode.FORBIDDEN,
        code: "FORBIDDEN_ERROR",
        message: "Forbidden request",
      },
      notFound: {
        statusCode: HttpStatusCode.NOT_FOUND,
        code: "NOT_FOUND",
        message: "No matching resource found",
      },
      methodNotAllowed: {
        statusCode: HttpStatusCode.METHOD_NOT_ALLOWED,
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed for this resource",
      },
      payloadTooLarge: {
        statusCode: HttpStatusCode.PAYLOAD_TOO_LARGE,
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds size limit",
      },
      internalServerError: {
        statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error occurred",
      },
    });
  });

  test("creates literal error bodies from descriptors", () => {
    const body = createDefaultErrorBody(internalServerErrorDefaultError);

    expect(body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error occurred",
    });
    expectTypeOf(body.code).toEqualTypeOf<"INTERNAL_SERVER_ERROR">();
    expectTypeOf(body.message).toEqualTypeOf<"Internal server error occurred">();
  });

  test("merges additional body properties without weakening literals", () => {
    const body = createDefaultErrorBody(validationDefaultError, {
      issues: {
        body: [{ message: "Expected string", path: ["name"] }],
      },
    });

    expect(body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      issues: {
        body: [{ message: "Expected string", path: ["name"] }],
      },
    });
    expectTypeOf(body.code).toEqualTypeOf<"VALIDATION_ERROR">();
    expectTypeOf(body.message).toEqualTypeOf<"Invalid request">();
  });

  test("creates typed error responses from descriptors", () => {
    const response = createDefaultErrorResponse(methodNotAllowedDefaultError, {
      header: { Allow: "GET, POST" },
    });

    expect(response).toEqual({
      statusCode: HttpStatusCode.METHOD_NOT_ALLOWED,
      header: { Allow: "GET, POST" },
      body: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed for this resource",
      },
    });
    expectTypeOf(response.statusCode).toEqualTypeOf<HttpStatusCode.METHOD_NOT_ALLOWED>();
  });

  test("exports stable descriptor constants", () => {
    expect(badRequestDefaultError.code).toBe("BAD_REQUEST");
    expect(validationDefaultError.code).toBe("VALIDATION_ERROR");
    expect(unauthorizedDefaultError.code).toBe("UNAUTHORIZED_ERROR");
    expect(forbiddenDefaultError.code).toBe("FORBIDDEN_ERROR");
    expect(notFoundDefaultError.code).toBe("NOT_FOUND");
    expect(methodNotAllowedDefaultError.code).toBe("METHOD_NOT_ALLOWED");
    expect(payloadTooLargeDefaultError.code).toBe("PAYLOAD_TOO_LARGE");
    expect(internalServerErrorDefaultError.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
