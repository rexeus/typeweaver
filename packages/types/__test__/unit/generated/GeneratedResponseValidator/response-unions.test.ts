import assert from "node:assert";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  CreateTodoResponseValidator,
  DeleteTodoResponseValidator,
  ResponseValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  expectNoPartialData,
  responseIssueFor,
  safeValidateRaw,
  validCreateTodoHeader,
  validCreateTodoResponse,
  validDeleteTodoHeader,
  validDeleteTodoNoContentResponse,
  validDeleteTodoSuccessResponse,
  validForbiddenErrorResponse,
  validInternalServerErrorResponse,
  validTooManyRequestsErrorResponse,
  validUnauthorizedErrorResponse,
  validUnsupportedMediaTypeErrorResponse,
  validValidationErrorResponse,
} from "./fixtures.js";
import type { RuntimeResponse } from "./fixtures.js";
import type { ResponseEntry } from "test-utils";

const validTodoNotFoundErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NOT_FOUND,
  header: validCreateTodoHeader(),
  body: {
    message: "Todo not found",
    code: "TODO_NOT_FOUND_ERROR",
    actualValues: {
      todoId: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    },
  },
});

describe("Generated ResponseValidator operation and shared unions", () => {
  test.each([
    {
      scenario: "operation success",
      response: validCreateTodoResponse(),
      expectedType: "CreateTodoSuccess",
    },
    {
      scenario: "shared validation error",
      response: validValidationErrorResponse(),
      expectedType: "ValidationError",
    },
    {
      scenario: "shared unauthorized error",
      response: validUnauthorizedErrorResponse(),
      expectedType: "UnauthorizedError",
    },
    {
      scenario: "shared forbidden error",
      response: validForbiddenErrorResponse(),
      expectedType: "ForbiddenError",
    },
    {
      scenario: "shared unsupported media type error",
      response: validUnsupportedMediaTypeErrorResponse(),
      expectedType: "UnsupportedMediaTypeError",
    },
    {
      scenario: "shared too many requests error",
      response: validTooManyRequestsErrorResponse(),
      expectedType: "TooManyRequestsError",
    },
    {
      scenario: "shared internal error",
      response: validInternalServerErrorResponse(),
      expectedType: "InternalServerError",
    },
  ])("accepts CreateTodo $scenario responses", ({ response, expectedType }) => {
    const validator = new CreateTodoResponseValidator();

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe(expectedType);
  });

  test.each([
    {
      scenario: "operation success",
      response: validDeleteTodoSuccessResponse(),
      expectedType: "DeleteTodoSuccess",
    },
    {
      scenario: "operation-specific not found error",
      response: validTodoNotFoundErrorResponse(),
      expectedType: "TodoNotFoundError",
    },
    {
      scenario: "shared internal error",
      response: validInternalServerErrorResponse(),
      expectedType: "InternalServerError",
    },
  ])("accepts DeleteTodo $scenario responses", ({ response, expectedType }) => {
    const validator = new DeleteTodoResponseValidator();

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe(expectedType);
  });
});

describe("Generated ResponseValidator duplicate status-code fallthrough", () => {
  // Local concrete validator exercises abstract duplicate-status dispatch
  // without regenerating fixtures.
  class DuplicateStatusCodeValidator extends ResponseValidator {
    protected override readonly expectedStatusCodes = [200];
    protected override readonly responseEntries: readonly ResponseEntry[] = [
      {
        name: "NarrowSuccess",
        statusCode: 200,
        headerSchema: undefined,
        bodySchema: z.object({
          variant: z.literal("narrow"),
          data: z.string(),
        }),
      },
      {
        name: "WideSuccess",
        statusCode: 200,
        headerSchema: undefined,
        bodySchema: z.object({
          variant: z.literal("wide"),
          count: z.number(),
        }),
      },
    ];
  }

  test("matches the header-required 204 response when its header is valid", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = validDeleteTodoSuccessResponse();

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("DeleteTodoSuccess");
    expect(result.data.header).toEqual(validDeleteTodoHeader());
  });

  test("falls through to the headerless 204 response when the header is absent", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = validDeleteTodoNoContentResponse();

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("DeleteTodoNoContent");
  });

  test("accumulates response issues without a status-code issue when duplicate status variants do not match", () => {
    const validator = new DuplicateStatusCodeValidator();
    const response = {
      statusCode: 200,
      body: { variant: "unknown" },
    };

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.hasStatusCodeIssues()).toBe(false);
    expect(result.error.issues.map(issue => issue.type)).toEqual([
      "INVALID_RESPONSE",
      "INVALID_RESPONSE",
    ]);
    expect(
      responseIssueFor(result.error, "NarrowSuccess").bodyIssues.length
    ).toBeGreaterThan(0);
    expect(
      responseIssueFor(result.error, "WideSuccess").bodyIssues.length
    ).toBeGreaterThan(0);
  });
});

describe("Generated ResponseValidator response type discriminants", () => {
  test("adds the canonical type when the runtime input omits it", () => {
    const validator = new CreateTodoResponseValidator();
    const response = validCreateTodoResponse();

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
  });

  test("replaces a wrong runtime type with the canonical response type", () => {
    const validator = new CreateTodoResponseValidator();
    const response = {
      ...validCreateTodoResponse(),
      type: "UnauthorizedError",
    };

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
  });

  test("derives duplicate-status response type from the matched schema", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = {
      ...validDeleteTodoNoContentResponse(),
      type: "DeleteTodoSuccess",
    };

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("DeleteTodoNoContent");
  });
});
