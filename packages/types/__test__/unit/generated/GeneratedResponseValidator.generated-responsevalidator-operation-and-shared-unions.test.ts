import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  InvalidResponseIssue,
  IResponseValidator,
} from "@rexeus/typeweaver-core";
import {
  CreateTodoResponseValidator,
  DeleteTodoResponseValidator,
  OptionsTodoResponseValidator,
} from "test-utils";
import { describe, expect, expectTypeOf, test } from "vitest";
import type {
  CreateTodoResponse,
  DeleteTodoResponse,
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
  IDeleteTodoSuccessResponseHeader,
  OptionsTodoResponse,
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

const validDeleteTodoHeader = (): IDeleteTodoSuccessResponseHeader => ({
  "Content-Type": "application/json",
  "X-Single-Value": "delete-1",
  "X-Multi-Value": ["deleted"],
});

const validDeleteTodoSuccessResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
  header: validDeleteTodoHeader(),
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

    const result = validator.safeValidate(asHttpResponse(response));

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

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe(expectedType);
  });
});

describe("Generated ResponseValidator generic response contracts", () => {
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

describe("Generated ResponseValidator accumulated errors", () => {
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
    expect(responseIssueFor(result.error, "CreateTodoSuccess")).toMatchObject({
      type: "INVALID_RESPONSE",
      responseName: "CreateTodoSuccess",
    });
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
