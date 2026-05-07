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
} from "../../src/defaultError.js";
import type { DefaultErrorDescriptor } from "../../src/defaultError.js";
import { HttpStatusCode } from "../../src/HttpStatusCode.js";

const defaultErrorDescriptorCases = [
  {
    case: "bad request",
    registryKey: "badRequest",
    descriptor: badRequestDefaultError,
    expected: {
      statusCode: HttpStatusCode.BAD_REQUEST,
      code: "BAD_REQUEST",
      message: "Malformed request body",
    },
  },
  {
    case: "validation",
    registryKey: "validation",
    descriptor: validationDefaultError,
    expected: {
      statusCode: HttpStatusCode.BAD_REQUEST,
      code: "VALIDATION_ERROR",
      message: "Invalid request",
    },
  },
  {
    case: "unauthorized",
    registryKey: "unauthorized",
    descriptor: unauthorizedDefaultError,
    expected: {
      statusCode: HttpStatusCode.UNAUTHORIZED,
      code: "UNAUTHORIZED_ERROR",
      message: "Unauthorized request",
    },
  },
  {
    case: "forbidden",
    registryKey: "forbidden",
    descriptor: forbiddenDefaultError,
    expected: {
      statusCode: HttpStatusCode.FORBIDDEN,
      code: "FORBIDDEN_ERROR",
      message: "Forbidden request",
    },
  },
  {
    case: "not found",
    registryKey: "notFound",
    descriptor: notFoundDefaultError,
    expected: {
      statusCode: HttpStatusCode.NOT_FOUND,
      code: "NOT_FOUND",
      message: "No matching resource found",
    },
  },
  {
    case: "method not allowed",
    registryKey: "methodNotAllowed",
    descriptor: methodNotAllowedDefaultError,
    expected: {
      statusCode: HttpStatusCode.METHOD_NOT_ALLOWED,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed for this resource",
    },
  },
  {
    case: "payload too large",
    registryKey: "payloadTooLarge",
    descriptor: payloadTooLargeDefaultError,
    expected: {
      statusCode: HttpStatusCode.PAYLOAD_TOO_LARGE,
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body exceeds size limit",
    },
  },
  {
    case: "internal server error",
    registryKey: "internalServerError",
    descriptor: internalServerErrorDefaultError,
    expected: {
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error occurred",
    },
  },
] as const;

const customDefaultError = {
  statusCode: HttpStatusCode.CONFLICT,
  code: "CUSTOM_CONFLICT",
  message: "Custom conflict",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.CONFLICT,
  "CUSTOM_CONFLICT",
  "Custom conflict"
>;

describe("defaultError", () => {
  test.each(defaultErrorDescriptorCases)(
    "exposes the stable $case default error descriptor",
    ({ descriptor, expected, registryKey }) => {
      expect(descriptor).toEqual(expected);
      expect(defaultErrorDescriptors[registryKey]).toEqual(descriptor);
    }
  );

  test("uses the descriptor message when no error detail is supplied", () => {
    const body = createDefaultErrorBody(internalServerErrorDefaultError);

    expect(body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error occurred",
    });
    expectTypeOf(body.code).toEqualTypeOf<"INTERNAL_SERVER_ERROR">();
    expectTypeOf(
      body.message
    ).toEqualTypeOf<"Internal server error occurred">();
  });

  test("keeps body literals and supplied validation issue messages", () => {
    const issues = {
      body: [{ message: "Expected string", path: ["name"] }],
    };

    const body = createDefaultErrorBody(validationDefaultError, { issues });

    expect(body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      issues,
    });
    expectTypeOf(body.code).toEqualTypeOf<"VALIDATION_ERROR">();
    expectTypeOf(body.message).toEqualTypeOf<"Invalid request">();
  });

  test("keeps descriptor code and message when additional body fields collide", () => {
    const body = createDefaultErrorBody(validationDefaultError, {
      code: "CALLER_CODE",
      message: "Caller message",
      requestId: "req-1",
    });

    expect(body).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      requestId: "req-1",
    });
    expectTypeOf(body.code).toEqualTypeOf<"VALIDATION_ERROR">();
    expectTypeOf(body.message).toEqualTypeOf<"Invalid request">();
    expectTypeOf(body.requestId).toEqualTypeOf<string>();
  });

  test("creates default error responses with matching status and non-validation body detail", () => {
    const response = createDefaultErrorResponse(internalServerErrorDefaultError, {
      body: {
        requestId: "req-1",
      },
    });

    expect(response.statusCode).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
    expect(response.header).toBeUndefined();
    expect(response.body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error occurred",
      requestId: "req-1",
    });
    expectTypeOf(
      response.statusCode
    ).toEqualTypeOf<HttpStatusCode.INTERNAL_SERVER_ERROR>();
  });

  test("creates default error responses with descriptor body when no detail is supplied", () => {
    const response = createDefaultErrorResponse(internalServerErrorDefaultError);

    expect(response.statusCode).toBe(HttpStatusCode.INTERNAL_SERVER_ERROR);
    expect(response.header).toBeUndefined();
    expect(response.body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error occurred",
    });
    expectTypeOf(
      response.statusCode
    ).toEqualTypeOf<HttpStatusCode.INTERNAL_SERVER_ERROR>();
    expectTypeOf(response.body.code).toEqualTypeOf<"INTERNAL_SERVER_ERROR">();
    expectTypeOf(
      response.body.message
    ).toEqualTypeOf<"Internal server error occurred">();
  });

  test("preserves supplied response headers on default error responses", () => {
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
    expectTypeOf(
      response.statusCode
    ).toEqualTypeOf<HttpStatusCode.METHOD_NOT_ALLOWED>();
  });

  test("creates bodies from caller-authored default error descriptors", () => {
    const body = createDefaultErrorBody(customDefaultError, {
      requestId: "req-1",
    });

    expect(body).toEqual({
      code: "CUSTOM_CONFLICT",
      message: "Custom conflict",
      requestId: "req-1",
    });
    expectTypeOf(body.code).toEqualTypeOf<"CUSTOM_CONFLICT">();
    expectTypeOf(body.message).toEqualTypeOf<"Custom conflict">();
  });

  test("creates responses from caller-authored default error descriptors", () => {
    const response = createDefaultErrorResponse(customDefaultError, {
      body: { requestId: "req-1" },
    });

    expect(response).toEqual({
      statusCode: HttpStatusCode.CONFLICT,
      header: undefined,
      body: {
        code: "CUSTOM_CONFLICT",
        message: "Custom conflict",
        requestId: "req-1",
      },
    });
    expectTypeOf(
      response.statusCode
    ).toEqualTypeOf<HttpStatusCode.CONFLICT>();
  });

});
