import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  InvalidResponseIssue,
  InvalidStatusCodeIssue,
} from "@rexeus/typeweaver-core";
import {
  captureError,
  CreateTodoResponseValidator,
  DeleteTodoResponseValidator,
  TestObjectTrapError,
} from "test-utils";
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

const validDeleteTodoNoContentResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
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
});

describe("Generated ResponseValidator throwing status-code behavior", () => {
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
        throw new TestObjectTrapError("statusCode getter");
      },
    });

    expect(() => validator.safeValidate(asHttpResponse(response))).toThrow(
      "statusCode getter"
    );
  });
});

describe("Generated ResponseValidator response type discriminants", () => {
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

describe("Generated ResponseValidator object body contracts", () => {
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
    delete body["id"];
    delete body["title"];
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
});
