import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import {
  captureError,
  CreateTodoResponseValidator,
  TestObjectTrapError,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  expectNoPartialData,
  responseWithRuntimePart,
  safeValidateRaw,
  statusCodeIssueFor,
  validateRaw,
  validCreateTodoResponse,
  validForbiddenErrorResponse,
  validInternalServerErrorResponse,
  validTooManyRequestsErrorResponse,
  validUnauthorizedErrorResponse,
  validUnsupportedMediaTypeErrorResponse,
  validValidationErrorResponse,
  withoutRuntimePart,
} from "./fixtures.js";

describe("Generated ResponseValidator accepted status codes", () => {
  test.each([
    {
      scenario: "operation success",
      response: validCreateTodoResponse(),
      expectedType: "CreateTodoSuccess",
      expectedStatusCode: HttpStatusCode.CREATED,
    },
    {
      scenario: "shared validation error",
      response: validValidationErrorResponse(),
      expectedType: "ValidationError",
      expectedStatusCode: HttpStatusCode.BAD_REQUEST,
    },
    {
      scenario: "shared unauthorized error",
      response: validUnauthorizedErrorResponse(),
      expectedType: "UnauthorizedError",
      expectedStatusCode: HttpStatusCode.UNAUTHORIZED,
    },
    {
      scenario: "shared forbidden error",
      response: validForbiddenErrorResponse(),
      expectedType: "ForbiddenError",
      expectedStatusCode: HttpStatusCode.FORBIDDEN,
    },
    {
      scenario: "shared unsupported media type error",
      response: validUnsupportedMediaTypeErrorResponse(),
      expectedType: "UnsupportedMediaTypeError",
      expectedStatusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE,
    },
    {
      scenario: "shared too many requests error",
      response: validTooManyRequestsErrorResponse(),
      expectedType: "TooManyRequestsError",
      expectedStatusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    },
    {
      scenario: "shared internal server error",
      response: validInternalServerErrorResponse(),
      expectedType: "InternalServerError",
      expectedStatusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    },
  ])(
    "accepts the $scenario status code",
    ({ response, expectedType, expectedStatusCode }) => {
      const validator = new CreateTodoResponseValidator();

      const result = safeValidateRaw(validator, response);

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe(expectedType);
      expect(result.data.statusCode).toBe(expectedStatusCode);
    }
  );
});

describe("Generated ResponseValidator unknown status codes", () => {
  test("rejects an unknown status code with one status-code issue", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "statusCode",
      418
    );

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.hasStatusCodeIssues()).toBe(true);
    expect(statusCodeIssueFor(result.error)).toEqual({
      type: "INVALID_STATUS_CODE",
      invalidStatusCode: 418,
      expectedStatusCodes: [201, 400, 401, 403, 415, 429, 500],
    });
  });

  test("returns a non-throwing status-code failure for a symbol status code", () => {
    const validator = new CreateTodoResponseValidator();
    const invalidStatusCode = Symbol("201");
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "statusCode",
      invalidStatusCode
    );

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.issues).toHaveLength(1);
    expect(statusCodeIssueFor(result.error)).toEqual({
      type: "INVALID_STATUS_CODE",
      invalidStatusCode,
      expectedStatusCodes: [201, 400, 401, 403, 415, 429, 500],
    });
  });
});

describe("Generated ResponseValidator malformed status codes", () => {
  test.each([
    {
      scenario: "missing status code",
      response: withoutRuntimePart(validCreateTodoResponse(), "statusCode"),
      invalidStatusCode: undefined,
    },
    {
      scenario: "string status code",
      response: responseWithRuntimePart(
        validCreateTodoResponse(),
        "statusCode",
        "201"
      ),
      invalidStatusCode: "201",
    },
    {
      scenario: "null status code",
      response: responseWithRuntimePart(
        validCreateTodoResponse(),
        "statusCode",
        null
      ),
      invalidStatusCode: null,
    },
    {
      scenario: "null top-level response",
      response: null,
      invalidStatusCode: undefined,
    },
    {
      scenario: "undefined top-level response",
      response: undefined,
      invalidStatusCode: undefined,
    },
    {
      scenario: "string top-level response",
      response: "not a response",
      invalidStatusCode: undefined,
    },
    {
      scenario: "number top-level response",
      response: 201,
      invalidStatusCode: undefined,
    },
    {
      scenario: "boolean top-level response",
      response: true,
      invalidStatusCode: undefined,
    },
  ])(
    "returns a non-throwing status-code failure for $scenario",
    ({ response, invalidStatusCode }) => {
      const validator = new CreateTodoResponseValidator();

      const result = safeValidateRaw(validator, response);

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error.issues).toHaveLength(1);
      expect(statusCodeIssueFor(result.error)).toEqual({
        type: "INVALID_STATUS_CODE",
        invalidStatusCode,
        expectedStatusCodes: [201, 400, 401, 403, 415, 429, 500],
      });
    }
  );
});

describe("Generated ResponseValidator throwing status-code behavior", () => {
  test("throws a status-code validation error with the same issues for a primitive top-level response", () => {
    const validator = new CreateTodoResponseValidator();
    const response = "not a response";

    const safeResult = safeValidateRaw(validator, response);
    const thrownError = captureError<ResponseValidationError>(() =>
      validateRaw(validator, response)
    );

    expectNoPartialData(safeResult);
    assert(!safeResult.isValid);
    expect(thrownError).toBeInstanceOf(ResponseValidationError);
    expect(thrownError?.issues).toEqual(safeResult.error.issues);
  });

  test("propagates errors thrown by a hostile statusCode getter", () => {
    const validator = new CreateTodoResponseValidator();
    const response = Object.defineProperty({}, "statusCode", {
      enumerable: true,
      get() {
        throw new TestObjectTrapError("statusCode getter");
      },
    });

    expect(() => safeValidateRaw(validator, response)).toThrow(
      "statusCode getter"
    );
  });
});
