import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  InvalidStatusCodeIssue,
} from "@rexeus/typeweaver-core";
import { captureError, CreateTodoResponseValidator } from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
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

const responseWithRuntimePart = (
  response: RuntimeResponse,
  part: RuntimeResponsePart,
  value: unknown
): RuntimeResponse => ({
  ...response,
  [part]: value,
});

const asHttpResponse = (response: unknown): IHttpResponse =>
  response as IHttpResponse;

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

describe("Generated ResponseValidator safe and throwing contracts", () => {
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

      const result = validator.safeValidate(asHttpResponse(response));

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
});
