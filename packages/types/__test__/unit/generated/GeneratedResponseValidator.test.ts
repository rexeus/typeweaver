import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  InvalidResponseIssue,
  InvalidStatusCodeIssue,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import {
  captureError,
  CreateTodoResponseValidator,
  DeleteTodoResponseValidator,
  OptionsTodoResponseValidator,
  ResponseValidator,
} from "test-utils";
import { describe, expect, expectTypeOf, test } from "vitest";
import { z } from "zod";
import type {
  CreateTodoResponse,
  DeleteTodoResponse,
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
  IDeleteTodoBodyOnlyResponseBody,
  IDeleteTodoSuccessResponseHeader,
  IOptionsTodoSuccessResponseHeader,
  OptionsTodoResponse,
  ResponseEntry,
} from "test-utils";

type RuntimeResponse = {
  readonly type?: string;
  readonly statusCode?: unknown;
  readonly header?: unknown;
  readonly body?: unknown;
};

type RuntimeResponsePart = "body" | "header" | "statusCode";

const validCreateTodoBody = (): ICreateTodoSuccessResponseBody => ({
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  accountId: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
  title: "Write reference-quality response validator specs",
  description: "Replace broad checks with public contract examples",
  status: "TODO",
  dueDate: "2026-05-08T00:00:00.000Z",
  tags: ["contracts", "validators"],
  priority: "HIGH",
  createdAt: "2026-05-07T08:00:00.000Z",
  modifiedAt: "2026-05-07T09:00:00.000Z",
  createdBy: "ada",
  modifiedBy: "grace",
});

const validCreateTodoHeader = (): ICreateTodoSuccessResponseHeader => ({
  "Content-Type": "application/json",
  "X-Single-Value": "request-1",
  "X-Multi-Value": ["alpha", "0"],
});

const validCreateTodoResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.CREATED,
  header: validCreateTodoHeader(),
  body: validCreateTodoBody(),
});

const validOptionsTodoHeader = (): IOptionsTodoSuccessResponseHeader => ({
  Allow: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  "Access-Control-Allow-Headers": ["Content-Type", "Authorization"],
  "Access-Control-Allow-Methods": [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  "Access-Control-Max-Age": "3600",
  "Access-Control-Allow-Origin": "*",
});

const validOptionsTodoResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.OK,
  header: validOptionsTodoHeader(),
});

const validDeleteTodoHeader = (): IDeleteTodoSuccessResponseHeader => ({
  "Content-Type": "application/json",
  "X-Single-Value": "delete-1",
  "X-Multi-Value": ["deleted"],
});

const validDeleteTodoSuccessResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
  header: validDeleteTodoHeader(),
});

const validDeleteTodoBodyOnlyBody = (): IDeleteTodoBodyOnlyResponseBody => ({
  message: "Todo deleted",
});

const validDeleteTodoBodyOnlyResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.OK,
  body: validDeleteTodoBodyOnlyBody(),
});

const validDeleteTodoNoContentResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
});

const validValidationErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.BAD_REQUEST,
  header: validCreateTodoHeader(),
  body: {
    message: "Request is invalid",
    code: "VALIDATION_ERROR",
    issues: {
      body: [
        {
          path: ["title"],
          message: "Required field missing",
          code: "invalid_type",
        },
      ],
      query: undefined,
      param: undefined,
      header: undefined,
    },
  },
});

const validUnauthorizedErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.UNAUTHORIZED,
  header: validCreateTodoHeader(),
  body: {
    message: "Unauthorized request",
    code: "UNAUTHORIZED_ERROR",
  },
});

const validForbiddenErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.FORBIDDEN,
  header: validCreateTodoHeader(),
  body: {
    message: "Forbidden request",
    code: "FORBIDDEN_ERROR",
  },
});

const validTooManyRequestsErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
  header: validCreateTodoHeader(),
  body: {
    message: "Too many requests",
    code: "TOO_MANY_REQUESTS_ERROR",
  },
});

const validUnsupportedMediaTypeErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE,
  header: validCreateTodoHeader(),
  body: {
    message: "Unsupported media type",
    code: "UNSUPPORTED_MEDIA_TYPE_ERROR",
    context: {
      contentType: "text/plain",
    },
    expectedValues: {
      contentTypes: ["application/json"],
    },
  },
});

const validInternalServerErrorResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  header: validCreateTodoHeader(),
  body: {
    message: "Internal server error occurred",
    code: "INTERNAL_SERVER_ERROR",
  },
});

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

const responseWithRuntimePart = (
  response: RuntimeResponse,
  part: RuntimeResponsePart,
  value: unknown
): RuntimeResponse => ({
  ...response,
  [part]: value,
});

const withoutRuntimePart = (
  response: RuntimeResponse,
  part: RuntimeResponsePart
): RuntimeResponse => {
  const copy: Record<string, unknown> = { ...response };
  delete copy[part];
  return copy;
};

const asHttpResponse = (response: unknown): IHttpResponse =>
  response as IHttpResponse;

const responseIssueFor = (
  error: ResponseValidationError,
  responseName: string
): InvalidResponseIssue => {
  const issue = error.issues.find(
    candidate =>
      candidate.type === "INVALID_RESPONSE" &&
      candidate.responseName === responseName
  );
  assert(issue?.type === "INVALID_RESPONSE");
  return issue;
};

const statusCodeIssueFor = (
  error: ResponseValidationError
): InvalidStatusCodeIssue => {
  const issue = error.issues.find(
    candidate => candidate.type === "INVALID_STATUS_CODE"
  );
  assert(issue?.type === "INVALID_STATUS_CODE");
  return issue;
};

const issuePaths = (
  issues: readonly { readonly path: readonly (string | number | symbol)[] }[]
): string[] => issues.map(issue => issue.path.join("."));

const expectNoPartialData = (result: {
  readonly isValid: boolean;
  readonly data?: unknown;
}): void => {
  expect(result.isValid).toBe(false);
  expect("data" in result).toBe(false);
};

describe("Generated ResponseValidator", () => {
  describe("safe and throwing validation contracts", () => {
    test("normalizes a valid response through the safe path", () => {
      const validator = new CreateTodoResponseValidator();
      const response = validCreateTodoResponse();

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toEqual({
        type: "CreateTodoSuccess",
        statusCode: HttpStatusCode.CREATED,
        header: validCreateTodoHeader(),
        body: validCreateTodoBody(),
      });
    });

    test("returns the same normalized data from the throwing path", () => {
      const validator = new CreateTodoResponseValidator();
      const response = validCreateTodoResponse();

      const safeResult = validator.safeValidate(asHttpResponse(response));
      const validated = validator.validate(asHttpResponse(response));

      expect(safeResult.isValid).toBe(true);
      assert(safeResult.isValid);
      expect(validated).toEqual(safeResult.data);
    });

    test("returns a failure for an invalid body field without throwing or exposing partial data", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        {
          ...validCreateTodoBody(),
          id: 123,
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error).toBeInstanceOf(ResponseValidationError);
      expect(
        issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
      ).toEqual(["id"]);
    });

    test("throws a response validation error with the same issues as the safe path", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        {
          ...validCreateTodoBody(),
          status: "BLOCKED",
        }
      );

      const safeResult = validator.safeValidate(asHttpResponse(response));
      const thrownError = captureError<ResponseValidationError>(() =>
        validator.validate(asHttpResponse(response))
      );

      expect(safeResult.isValid).toBe(false);
      assert(!safeResult.isValid);
      expect(thrownError).toBeInstanceOf(ResponseValidationError);
      expect(thrownError?.issues).toEqual(safeResult.error.issues);
    });
  });

  describe("status code contracts", () => {
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

        const result = validator.safeValidate(asHttpResponse(response));

        expect(result.isValid).toBe(true);
        assert(result.isValid);
        expect(result.data.type).toBe(expectedType);
        expect(result.data.statusCode).toBe(expectedStatusCode);
      }
    );

    test("rejects an unknown status code with one status-code issue", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "statusCode",
        418
      );

      const result = validator.safeValidate(asHttpResponse(response));

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

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error.issues).toHaveLength(1);
      expect(statusCodeIssueFor(result.error)).toEqual({
        type: "INVALID_STATUS_CODE",
        invalidStatusCode,
        expectedStatusCodes: [201, 400, 401, 403, 415, 429, 500],
      });
    });

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

        const result = validator.safeValidate(asHttpResponse(response));

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

    test("throws a status-code validation error with the same issues for a primitive top-level response", () => {
      const validator = new CreateTodoResponseValidator();
      const response = "not a response";

      const safeResult = validator.safeValidate(asHttpResponse(response));
      const thrownError = captureError<ResponseValidationError>(() =>
        validator.validate(asHttpResponse(response))
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
          throw new Error("statusCode getter");
        },
      });

      expect(() => validator.safeValidate(asHttpResponse(response))).toThrow(
        "statusCode getter"
      );
    });
  });

  describe("response type discriminants", () => {
    test("adds the canonical type when the runtime input omits it", () => {
      const validator = new CreateTodoResponseValidator();
      const response = validCreateTodoResponse();

      const result = validator.safeValidate(asHttpResponse(response));

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

      const result = validator.safeValidate(asHttpResponse(response));

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

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("DeleteTodoNoContent");
    });
  });

  describe("response body contracts", () => {
    test("returns the exact parsed body for a valid success response", () => {
      const validator = new CreateTodoResponseValidator();
      const response = validCreateTodoResponse();

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.body).toEqual(validCreateTodoBody());
    });

    test("strips unknown fields from a valid response body", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        {
          ...validCreateTodoBody(),
          extraField: "ignored",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.body).toEqual(validCreateTodoBody());
      expect(result.data.body).not.toHaveProperty("extraField");
    });

    test("reports missing required body fields by path", () => {
      const validator = new CreateTodoResponseValidator();
      const body: Record<string, unknown> = { ...validCreateTodoBody() };
      delete body.id;
      delete body.title;
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        body
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
      ).toEqual(["id", "title"]);
    });

    test("reports a missing required body part without a status-code issue", () => {
      const validator = new CreateTodoResponseValidator();
      const response = withoutRuntimePart(validCreateTodoResponse(), "body");

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error.hasStatusCodeIssues()).toBe(false);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").bodyIssues.length
      ).toBeGreaterThan(0);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").headerIssues
      ).toHaveLength(0);
    });

    test("reports invalid body field types by path", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        {
          ...validCreateTodoBody(),
          id: 123,
          title: null,
          status: "BLOCKED",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
      ).toEqual(["id", "title", "status"]);
    });

    test("does not coerce body array fields from strings", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        {
          ...validCreateTodoBody(),
          tags: "contracts,validators",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
      ).toEqual(["tags"]);
    });

    test.each([
      { scenario: "null body", body: null },
      { scenario: "string body", body: "not an object" },
      { scenario: "number body", body: 123 },
      { scenario: "array body", body: [validCreateTodoBody()] },
    ])("rejects a malformed object body for $scenario", ({ body }) => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "body",
        body
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").bodyIssues.length
      ).toBeGreaterThan(0);
    });
  });

  describe("response header contracts", () => {
    test("returns schema-cased parsed headers for a valid response", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          "content-type": "application/json",
          "x-single-value": "request-1",
          "x-multi-value": ["alpha", "0"],
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.header).toEqual(validCreateTodoHeader());
    });

    test("strips unknown response header keys", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          ...validCreateTodoHeader(),
          "X-Trace-Id": "trace-1",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.header).toEqual(validCreateTodoHeader());
      expect(result.data.header).not.toHaveProperty("X-Trace-Id");
    });

    test("normalizes case-insensitive header keys to schema casing", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          "CONTENT-TYPE": "application/json",
          "x-single-value": "request-1",
          "x-multi-value": ["alpha", "0"],
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.header).toEqual(validCreateTodoHeader());
      expect(result.data.header).not.toHaveProperty("CONTENT-TYPE");
      expect(result.data.header).not.toHaveProperty("x-single-value");
      expect(result.data.header).not.toHaveProperty("x-multi-value");
    });

    test("merges duplicate casing collisions for array header schemas", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          ...validCreateTodoHeader(),
          "x-multi-value": ["beta", "1"],
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.header["X-Multi-Value"]).toEqual([
        "alpha",
        "0",
        "beta",
        "1",
      ]);
      expect(result.data.header).not.toHaveProperty("x-multi-value");
    });

    test("wraps a single header value when the schema expects an array", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          ...validCreateTodoHeader(),
          "X-Multi-Value": "solo",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.header["X-Multi-Value"]).toEqual(["solo"]);
    });

    test("unwraps a single-element header array when the schema expects a scalar", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          ...validCreateTodoHeader(),
          "X-Single-Value": ["solo"],
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("CreateTodoSuccess");
      assert(result.data.type === "CreateTodoSuccess");
      expect(result.data.header["X-Single-Value"]).toBe("solo");
    });

    test("rejects a multi-element header array when the schema expects a scalar", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          ...validCreateTodoHeader(),
          "X-Single-Value": ["one", "two"],
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
      ).toEqual(["X-Single-Value"]);
    });

    test("splits comma-separated strings only for array header schema fields", () => {
      const validator = new OptionsTodoResponseValidator();
      const response = responseWithRuntimePart(
        validOptionsTodoResponse(),
        "header",
        {
          ...validOptionsTodoHeader(),
          Allow: " GET, ,0, OPTIONS, ",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("OptionsTodoSuccess");
      assert(result.data.type === "OptionsTodoSuccess");
      expect(result.data.header.Allow).toEqual(["GET", "0", "OPTIONS"]);
    });

    test("does not split comma-separated strings for scalar header schema fields", () => {
      const validator = new OptionsTodoResponseValidator();
      const response = responseWithRuntimePart(
        validOptionsTodoResponse(),
        "header",
        {
          ...validOptionsTodoHeader(),
          "Access-Control-Allow-Origin":
            "https://one.example, https://two.example",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("OptionsTodoSuccess");
      assert(result.data.type === "OptionsTodoSuccess");
      expect(result.data.header["Access-Control-Allow-Origin"]).toBe(
        "https://one.example, https://two.example"
      );
    });

    test("does not re-split header values that are already arrays", () => {
      const validator = new OptionsTodoResponseValidator();
      const response = responseWithRuntimePart(
        validOptionsTodoResponse(),
        "header",
        {
          ...validOptionsTodoHeader(),
          Allow: ["GET,POST", "OPTIONS"],
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("OptionsTodoSuccess");
      assert(result.data.type === "OptionsTodoSuccess");
      expect(result.data.header.Allow).toEqual(["GET,POST", "OPTIONS"]);
    });

    test.each([
      { scenario: "null header", header: null },
      { scenario: "primitive header", header: "not an object" },
      { scenario: "array header", header: [validCreateTodoHeader()] },
    ])(
      "rejects a malformed required header shape for $scenario",
      ({ header }) => {
        const validator = new CreateTodoResponseValidator();
        const response = responseWithRuntimePart(
          validCreateTodoResponse(),
          "header",
          header
        );

        const result = validator.safeValidate(asHttpResponse(response));

        expectNoPartialData(result);
        assert(!result.isValid);
        expect(
          responseIssueFor(result.error, "CreateTodoSuccess").headerIssues
            .length
        ).toBeGreaterThan(0);
      }
    );

    test("reports a missing required header part without a status-code issue", () => {
      const validator = new CreateTodoResponseValidator();
      const response = withoutRuntimePart(validCreateTodoResponse(), "header");

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error.hasStatusCodeIssues()).toBe(false);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").headerIssues.length
      ).toBeGreaterThan(0);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").bodyIssues
      ).toHaveLength(0);
    });

    test("rejects duplicate casing collisions for singleton header schemas", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        {
          ...validCreateTodoHeader(),
          "content-type": "application/json",
        }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
      ).toEqual(["Content-Type"]);
    });
  });

  describe("bodyless and headerless response contracts", () => {
    test("validates header-only responses and strips an unexpected body", () => {
      const validator = new DeleteTodoResponseValidator();
      const response = responseWithRuntimePart(
        validDeleteTodoSuccessResponse(),
        "body",
        { ignored: true }
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toEqual({
        type: "DeleteTodoSuccess",
        statusCode: HttpStatusCode.NO_CONTENT,
        header: validDeleteTodoHeader(),
        body: undefined,
      });
    });

    test("validates body-only responses and strips an unexpected header", () => {
      const validator = new DeleteTodoResponseValidator();
      const response = responseWithRuntimePart(
        validDeleteTodoBodyOnlyResponse(),
        "header",
        validDeleteTodoHeader()
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toEqual({
        type: "DeleteTodoBodyOnly",
        statusCode: HttpStatusCode.OK,
        header: undefined,
        body: validDeleteTodoBodyOnlyBody(),
      });
    });

    test("validates headerless bodyless responses and ignores unexpected payload parts", () => {
      const validator = new DeleteTodoResponseValidator();
      const response = {
        ...validDeleteTodoNoContentResponse(),
        header: { "X-Ignored": "true" },
        body: { ignored: true },
      };

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toEqual({
        type: "DeleteTodoNoContent",
        statusCode: HttpStatusCode.NO_CONTENT,
        header: undefined,
        body: undefined,
      });
    });
  });

  describe("duplicate status-code fallthrough", () => {
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

      const result = validator.safeValidate(asHttpResponse(response));

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.type).toBe("DeleteTodoSuccess");
      expect(result.data.header).toEqual(validDeleteTodoHeader());
    });

    test("falls through to the headerless 204 response when the header is absent", () => {
      const validator = new DeleteTodoResponseValidator();
      const response = validDeleteTodoNoContentResponse();

      const result = validator.safeValidate(asHttpResponse(response));

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

      const result = validator.safeValidate(asHttpResponse(response));

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

  describe("operation and shared response unions", () => {
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
    ])(
      "accepts CreateTodo $scenario responses",
      ({ response, expectedType }) => {
        const validator = new CreateTodoResponseValidator();

        const result = validator.safeValidate(asHttpResponse(response));

        expect(result.isValid).toBe(true);
        assert(result.isValid);
        expect(result.data.type).toBe(expectedType);
      }
    );

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
    ])(
      "accepts DeleteTodo $scenario responses",
      ({ response, expectedType }) => {
        const validator = new DeleteTodoResponseValidator();

        const result = validator.safeValidate(asHttpResponse(response));

        expect(result.isValid).toBe(true);
        assert(result.isValid);
        expect(result.data.type).toBe(expectedType);
      }
    );

    test("assigns generated validators to the generic response validator contract", () => {
      const createValidator: IResponseValidator<CreateTodoResponse> =
        new CreateTodoResponseValidator();
      const deleteValidator: IResponseValidator<DeleteTodoResponse> =
        new DeleteTodoResponseValidator();
      const optionsValidator: IResponseValidator<OptionsTodoResponse> =
        new OptionsTodoResponseValidator();

      expectTypeOf(createValidator).toMatchTypeOf<
        IResponseValidator<CreateTodoResponse>
      >();
      expectTypeOf(deleteValidator).toMatchTypeOf<
        IResponseValidator<DeleteTodoResponse>
      >();
      expectTypeOf(optionsValidator).toMatchTypeOf<
        IResponseValidator<OptionsTodoResponse>
      >();
    });

    test("preserves CreateTodo response types through safe and throwing generic validation", () => {
      const createValidator: IResponseValidator<CreateTodoResponse> =
        new CreateTodoResponseValidator();

      const safeResult = createValidator.safeValidate(
        asHttpResponse(validCreateTodoResponse())
      );
      const validated = createValidator.validate(
        asHttpResponse(validCreateTodoResponse())
      );

      expect(safeResult.isValid).toBe(true);
      assert(safeResult.isValid);
      expectTypeOf(safeResult.data).toEqualTypeOf<CreateTodoResponse>();
      expectTypeOf(validated).toEqualTypeOf<CreateTodoResponse>();
    });
  });

  describe("accumulated errors", () => {
    test("groups invalid body and header issues under the matching response name", () => {
      const validator = new CreateTodoResponseValidator();
      const response = {
        ...validCreateTodoResponse(),
        header: {
          ...validCreateTodoHeader(),
          "Content-Type": "text/plain",
        },
        body: {
          ...validCreateTodoBody(),
          id: 123,
          status: "BLOCKED",
        },
      };

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error.issues).toHaveLength(1);
      expect(responseIssueFor(result.error, "CreateTodoSuccess")).toMatchObject(
        {
          type: "INVALID_RESPONSE",
          responseName: "CreateTodoSuccess",
        }
      );
      expect(
        issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
      ).toEqual(["Content-Type"]);
      expect(
        issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
      ).toEqual(["id", "status"]);
    });

    test("reports only a status-code issue when the status code is invalid", () => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "statusCode",
        418
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.type).toBe("INVALID_STATUS_CODE");
      expect(result.error.hasResponseIssues()).toBe(false);
    });
  });
});
