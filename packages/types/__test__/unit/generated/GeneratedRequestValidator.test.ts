import assert from "node:assert";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import {
  captureError,
  CreateTodoRequestValidator,
  GetTodoRequestValidator,
  ListTodosRequestValidator,
  QuerySubTodoRequestValidator,
  UploadFileRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  ICreateTodoRequest,
  IGetTodoRequest,
  IListTodosRequest,
  IQuerySubTodoRequest,
  IUploadFileRequest,
} from "test-utils";

const TODO_ID = "01K0W0Y49HZVW1QTN6RZJJY203";

const AUTHORIZATION = "Bearer reference-token";

const validCreateTodoRequest = (): ICreateTodoRequest => ({
  method: HttpMethod.POST,
  path: "/todos",
  header: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  body: {
    title: "Write reference request validator specs",
    description: "Cover the generated request validator public contract.",
    dueDate: "2026-06-01T00:00:00.000Z",
    tags: ["testing", "contracts"],
    priority: "HIGH",
  },
});

const validGetTodoRequest = (): IGetTodoRequest => ({
  method: HttpMethod.GET,
  path: `/todos/${TODO_ID}`,
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
  },
});

const validListTodosRequest = (): IListTodosRequest => ({
  method: HttpMethod.GET,
  path: "/todos",
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  query: {
    status: "TODO",
    priority: "MEDIUM",
    tags: ["testing", "contracts"],
    limit: "25",
    nextToken: "next-page-token",
    sortBy: "createdAt",
    sortOrder: "desc",
    search: "validator",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
  },
});

const validQuerySubTodoRequest = (): IQuerySubTodoRequest => ({
  method: HttpMethod.POST,
  path: `/todos/${TODO_ID}/subtodos/query`,
  header: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
  },
  query: {
    limit: "10",
    sortBy: "createdAt",
    sortOrder: "asc",
    format: "summary",
  },
  body: {
    searchText: "reference",
    status: "TODO",
    priority: "LOW",
    dateRange: {
      from: "2026-05-01",
      to: "2026-05-31",
    },
    tags: ["testing"],
  },
});

const validUploadFileRequest = (): IUploadFileRequest => ({
  method: HttpMethod.POST,
  path: "/files",
  header: {
    "Content-Type": "application/octet-stream",
    Authorization: AUTHORIZATION,
    "X-File-Name": "reference.txt",
  },
  body: new Uint8Array([1, 2, 3]),
});

const requestWithRuntimePart = (
  request: IRawHttpRequest,
  part: "body" | "header" | "param" | "query",
  value: unknown
): IRawHttpRequest => ({
  ...request,
  [part]: value,
});

const issuePaths = (issues: RequestValidationError["bodyIssues"]) =>
  issues.map(issue => issue.path);

const querySubTodoRequestWithInvalidBodyHeaderParamAndQuery =
  (): IRawHttpRequest =>
    requestWithRuntimePart(
      requestWithRuntimePart(
        requestWithRuntimePart(
          requestWithRuntimePart(validQuerySubTodoRequest(), "body", {
            status: "BLOCKED",
          }),
          "header",
          { Accept: "text/plain" }
        ),
        "param",
        { todoId: "not-a-ulid" }
      ),
      "query",
      { sortBy: "updatedAt" }
    );

describe("Generated RequestValidator safeValidate and validate contracts", () => {
  test("returns success with normalized data for a valid create todo request", () => {
    const validator = new CreateTodoRequestValidator();
    const request = validCreateTodoRequest();

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual(request);
  });

  test("returns success with normalized data for a valid get todo request", () => {
    const validator = new GetTodoRequestValidator();
    const request = validGetTodoRequest();

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data).toEqual(request);
  });

  test("returns success with normalized data for a valid list todos request", () => {
    const validator = new ListTodosRequestValidator();
    const request = validListTodosRequest();

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data).toEqual(request);
  });

  test("returns bodyIssues without throwing when the title has the wrong type", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: 123,
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(result.error).toBeInstanceOf(RequestValidationError);
    expect(result.error.bodyIssues).toHaveLength(1);
  });

  test("returns the same normalized data from validate as safeValidate", () => {
    const validator = new ListTodosRequestValidator();
    const request = requestWithRuntimePart(validListTodosRequest(), "query", {
      limit: ["25"],
      tags: "contracts",
    });

    const safeResult = validator.safeValidate(request);
    const directResult = validator.validate(request);

    expect(safeResult.isValid).toBe(true);
    assert(safeResult.isValid);
    expect(directResult).toEqual(safeResult.data);
  });

  test("throws RequestValidationError for an invalid path parameter", () => {
    const validator = new GetTodoRequestValidator();
    const request = requestWithRuntimePart(validGetTodoRequest(), "param", {
      todoId: "not-a-ulid",
    });

    expect(() => validator.validate(request)).toThrow(RequestValidationError);
  });

  test("preserves safeValidate issue categories on the thrown error", () => {
    const validator = new QuerySubTodoRequestValidator();
    const request = querySubTodoRequestWithInvalidBodyHeaderParamAndQuery();

    const safeResult = validator.safeValidate(request);
    const thrownError = captureError<RequestValidationError>(() =>
      validator.validate(request)
    );

    expect(safeResult.isValid).toBe(false);
    assert(!safeResult.isValid);
    expect(thrownError).toBeInstanceOf(RequestValidationError);
    assert(thrownError instanceof RequestValidationError);
    expect(thrownError.bodyIssues).toEqual(safeResult.error.bodyIssues);
    expect(thrownError.headerIssues).toEqual(safeResult.error.headerIssues);
    expect(thrownError.pathParamIssues).toEqual(
      safeResult.error.pathParamIssues
    );
    expect(thrownError.queryIssues).toEqual(safeResult.error.queryIssues);
  });

  test("normalizes the operation method and preserves the request path", () => {
    const validator = new GetTodoRequestValidator();
    const request: IRawHttpRequest = {
      ...validGetTodoRequest(),
      method: HttpMethod.POST,
      path: "/not-the-todo-route",
    };

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.method).toBe(HttpMethod.GET);
    expect(result.data.path).toBe("/not-the-todo-route");
  });
});

describe("Generated RequestValidator body object contracts", () => {
  test("strips unknown top-level body fields from a valid body", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Only known body fields remain",
      description: "Unknown fields are not part of the contract.",
      extraBodyField: "strip me",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.body).toEqual({
      title: "Only known body fields remain",
      description: "Unknown fields are not part of the contract.",
    });
  });

  test("reports bodyIssues when a required body field is missing", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      description: "The required title is missing.",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toContainEqual(["title"]);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test("accepts a body with optional fields omitted", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Minimal todo",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.body).toEqual({ title: "Minimal todo" });
  });

  test("reports bodyIssues when an optional enum has an invalid value", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Invalid priority",
      priority: "URGENT",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toContainEqual(["priority"]);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test("accepts an empty object for an all-optional body schema", () => {
    const validator = new QuerySubTodoRequestValidator();
    const request = requestWithRuntimePart(
      validQuerySubTodoRequest(),
      "body",
      {}
    );

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.body).toEqual({});
  });
});

describe("Generated RequestValidator body shape contracts", () => {
  test.each([
    { scenario: "null", body: null },
    { scenario: "primitive string", body: "not an object" },
    { scenario: "primitive number", body: 42 },
    { scenario: "array", body: ["not", "a", "body"] },
  ])("reports bodyIssues for a malformed $scenario body", ({ body }) => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(
      validCreateTodoRequest(),
      "body",
      body
    );

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(result.error.bodyIssues.length).toBeGreaterThan(0);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test("reports bodyIssues without coercion when a body array field receives a singleton", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Do not coerce body arrays",
      tags: "testing",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toContainEqual(["tags"]);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test.each([
    { scenario: "Uint8Array", body: new Uint8Array([1, 2, 3]) },
    { scenario: "string", body: "raw file contents" },
  ])(
    "accepts a non-object $scenario body for a z.any upload payload",
    ({ body }) => {
      const validator = new UploadFileRequestValidator();
      const request = requestWithRuntimePart(
        validUploadFileRequest(),
        "body",
        body
      );

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.body).toEqual(body);
    }
  );
});
