import assert from "node:assert";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type {
  ICreateTodoRequest,
  IDeleteTodoRequest,
  IGetTodoRequest,
  IListSubTodosRequest,
  IListTodosRequest,
  IOptionsTodoRequest,
  IQuerySubTodoRequest,
  IUploadFileRequest,
} from "test-utils";
import {
  captureError,
  CreateTodoRequestValidator,
  DeleteTodoRequestValidator,
  GetTodoRequestValidator,
  ListSubTodosRequestValidator,
  ListTodosRequestValidator,
  OptionsTodoRequestValidator,
  QuerySubTodoRequestValidator,
  UploadFileRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";

const TODO_ID = "01K0W0Y49HZVW1QTN6RZJJY203";
const OTHER_TODO_ID = "01K0W0ZJA0DQE5D3CB5MP2FGKT";
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

const validOptionsTodoRequest = (): IOptionsTodoRequest => ({
  method: HttpMethod.OPTIONS,
  path: `/todos/${TODO_ID}`,
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": ["Content-Type", "Authorization"],
  },
  param: {
    todoId: TODO_ID,
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

const validListSubTodosRequest = (): IListSubTodosRequest => ({
  method: HttpMethod.GET,
  path: `/todos/${TODO_ID}/subtodos`,
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
  },
  query: {
    limit: "10",
    nextToken: "next-page-token",
    sortBy: "createdAt",
    sortOrder: "asc",
  },
});

const validDeleteTodoRequest = (): IDeleteTodoRequest => ({
  method: HttpMethod.DELETE,
  path: `/todos/${TODO_ID}`,
  header: {
    Accept: "application/json",
    Authorization: AUTHORIZATION,
  },
  param: {
    todoId: TODO_ID,
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
  request: IHttpRequest,
  part: "body" | "header" | "param" | "query",
  value: unknown
): IHttpRequest => ({
  ...request,
  [part]: value,
});

const withoutRuntimePart = (
  request: IHttpRequest,
  part: "body" | "header" | "param" | "query"
): IHttpRequest => {
  const clone = { ...request };
  delete clone[part];
  return clone;
};

const issuePaths = (issues: RequestValidationError["bodyIssues"]) =>
  issues.map(issue => issue.path);

const querySubTodoRequestWithInvalidBodyHeaderParamAndQuery = (): IHttpRequest =>
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

describe("Generated RequestValidator", () => {
  describe("safeValidate and validate contracts", () => {
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

    test("preserves input method and path without route matching", () => {
      const validator = new GetTodoRequestValidator();
      const request: IHttpRequest = {
        ...validGetTodoRequest(),
        method: HttpMethod.POST,
        path: "/not-the-todo-route",
      };

      const result = validator.safeValidate(request);

      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.method).toBe(HttpMethod.POST);
      expect(result.data.path).toBe("/not-the-todo-route");
    });
  });

  describe("body contracts", () => {
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
      const request = requestWithRuntimePart(validQuerySubTodoRequest(), "body", {});

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.body).toEqual({});
    });

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
    ])("accepts a non-object $scenario body for a z.any upload payload", ({ body }) => {
      const validator = new UploadFileRequestValidator();
      const request = requestWithRuntimePart(validUploadFileRequest(), "body", body);

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.body).toEqual(body);
    });
  });

  describe("header contracts", () => {
    test("reports headerIssues when Authorization is missing", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "Content-Type": "application/json",
        Accept: "application/json",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.headerIssues)).toContainEqual([
        "Authorization",
      ]);
      expect(result.error.bodyIssues).toHaveLength(0);
    });

    test("accepts a header with optional fields absent", () => {
      const validator = new CreateTodoRequestValidator();
      const request = validCreateTodoRequest();

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header).toEqual({
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: AUTHORIZATION,
      });
    });

    test("strips unknown header keys", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: AUTHORIZATION,
        "X-Unknown-Header": "strip me",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header).toEqual({
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: AUTHORIZATION,
      });
    });

    test("matches header keys case-insensitively and returns schema casing", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "content-type": "application/json",
        accept: "application/json",
        authorization: AUTHORIZATION,
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header).toEqual({
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: AUTHORIZATION,
      });
    });

    test("wraps a singleton header value when the schema expects an array", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: AUTHORIZATION,
        "X-Multi-Value": "one",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header["X-Multi-Value"]).toEqual(["one"]);
    });

    test("unwraps a single-element header array when the schema expects a scalar", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "Content-Type": ["application/json"],
        Accept: ["application/json"],
        Authorization: [AUTHORIZATION],
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header).toEqual({
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: AUTHORIZATION,
      });
    });

    test("rejects a multi-element header array when the schema expects a scalar", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "Content-Type": "application/json",
        Accept: ["application/json", "text/plain"],
        Authorization: AUTHORIZATION,
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.headerIssues)).toContainEqual(["Accept"]);
    });

    test("rejects duplicate singleton headers with different casing", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "header", {
        "Content-Type": "application/json",
        Accept: "application/json",
        accept: "application/json",
        Authorization: AUTHORIZATION,
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.headerIssues)).toContainEqual(["Accept"]);
    });

    test("merges duplicate array headers with different casing", () => {
      const validator = new OptionsTodoRequestValidator();
      const request = requestWithRuntimePart(validOptionsTodoRequest(), "header", {
        Accept: "application/json",
        Authorization: AUTHORIZATION,
        "Access-Control-Request-Headers": "Content-Type",
        "access-control-request-headers": "Authorization",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header["Access-Control-Request-Headers"]).toEqual([
        "Content-Type",
        "Authorization",
      ]);
    });

    test("splits comma-separated strings only for array header fields", () => {
      const validator = new OptionsTodoRequestValidator();
      const request = requestWithRuntimePart(validOptionsTodoRequest(), "header", {
        Accept: "application/json",
        Authorization: "Bearer token,with-comma",
        "Access-Control-Request-Headers": " Content-Type, , Authorization, ",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header.Authorization).toBe("Bearer token,with-comma");
      expect(result.data.header["Access-Control-Request-Headers"]).toEqual([
        "Content-Type",
        "Authorization",
      ]);
    });

    test("does not re-split header values already represented as arrays", () => {
      const validator = new OptionsTodoRequestValidator();
      const request = requestWithRuntimePart(validOptionsTodoRequest(), "header", {
        Accept: "application/json",
        Authorization: AUTHORIZATION,
        "Access-Control-Request-Headers": ["Content-Type, Authorization"],
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.header["Access-Control-Request-Headers"]).toEqual([
        "Content-Type, Authorization",
      ]);
    });

    test.each([
      { scenario: "undefined", header: undefined },
      { scenario: "null", header: null },
      { scenario: "primitive", header: "not headers" },
      { scenario: "array", header: ["not", "headers"] },
    ])(
      "reports headerIssues for a malformed $scenario header shape",
      ({ header }) => {
        const validator = new CreateTodoRequestValidator();
        const request = requestWithRuntimePart(
          validCreateTodoRequest(),
          "header",
          header
        );

        const result = validator.safeValidate(request);
        expect(result.isValid).toBe(false);
        assert(!result.isValid);
        expect(result.error.headerIssues.length).toBeGreaterThan(0);
        expect(result.error.bodyIssues).toHaveLength(0);
      }
    );
  });

  describe("query contracts", () => {
    test("strips unknown query keys from a valid query", () => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(validListTodosRequest(), "query", {
        status: "DONE",
        limit: "50",
        extraQuery: "strip me",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query).toEqual({
        status: "DONE",
        limit: "50",
      });
    });

    test("matches query keys case-sensitively", () => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(validListTodosRequest(), "query", {
        STATUS: "DONE",
        sortBy: "priority",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query).toEqual({ sortBy: "priority" });
    });

    test("wraps a singleton query value when the schema expects an array", () => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(validListTodosRequest(), "query", {
        tags: "contracts",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query.tags).toEqual(["contracts"]);
    });

    test("unwraps a single-element query array when the schema expects a scalar", () => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(validListTodosRequest(), "query", {
        limit: ["25"],
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query.limit).toBe("25");
    });

    test("rejects a multi-element query array when the schema expects a scalar", () => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(validListTodosRequest(), "query", {
        limit: ["25", "50"],
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.queryIssues)).toContainEqual(["limit"]);
    });

    test.each([
      { scenario: "missing", request: withoutRuntimePart(validListTodosRequest(), "query") },
      { scenario: "empty", request: requestWithRuntimePart(validListTodosRequest(), "query", {}) },
    ])("accepts a $scenario query for an all-optional query schema", ({ request }) => {
      const validator = new ListTodosRequestValidator();

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query).toEqual({});
    });

    test("returns an empty object for a missing optional query object", () => {
      const validator = new ListSubTodosRequestValidator();
      const request = withoutRuntimePart(validListSubTodosRequest(), "query");

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query).toEqual({});
    });

    test("treats a null optional query object as absent", () => {
      const validator = new ListSubTodosRequestValidator();
      const request = requestWithRuntimePart(
        validListSubTodosRequest(),
        "query",
        null
      );

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query).toEqual({});
    });

    test("rejects a query array instead of normalizing it to an empty object", () => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(validListTodosRequest(), "query", [
        "not",
        "a",
        "query",
      ]);

      const result = validator.safeValidate(request);

      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.queryIssues.length).toBeGreaterThan(0);
    });

    test.each([
      { scenario: "primitive string", query: "not a query" },
      { scenario: "primitive number", query: 42 },
    ])("reports queryIssues for a malformed $scenario query", ({ query }) => {
      const validator = new ListTodosRequestValidator();
      const request = requestWithRuntimePart(
        validListTodosRequest(),
        "query",
        query
      );

      const result = validator.safeValidate(request);

      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.queryIssues.length).toBeGreaterThan(0);
      expect(result.error.bodyIssues).toHaveLength(0);
      expect(result.error.headerIssues).toHaveLength(0);
      expect(result.error.pathParamIssues).toHaveLength(0);
    });
  });

  describe("path parameter contracts", () => {
    test("accepts a valid path parameter", () => {
      const validator = new GetTodoRequestValidator();
      const request = validGetTodoRequest();

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.param).toEqual({ todoId: TODO_ID });
    });

    test("reports pathParamIssues for an invalid ULID parameter", () => {
      const validator = new GetTodoRequestValidator();
      const request = requestWithRuntimePart(validGetTodoRequest(), "param", {
        todoId: "not-a-ulid",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.pathParamIssues)).toContainEqual([
        "todoId",
      ]);
    });

    test("reports pathParamIssues when a required parameter is missing", () => {
      const validator = new GetTodoRequestValidator();
      const request = requestWithRuntimePart(validGetTodoRequest(), "param", {});

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.pathParamIssues)).toContainEqual([
        "todoId",
      ]);
    });

    test.each([
      { scenario: "null", param: null },
      { scenario: "primitive", param: "not params" },
      { scenario: "array", param: [TODO_ID] },
    ])("reports pathParamIssues for a malformed $scenario parameter object", ({ param }) => {
      const validator = new GetTodoRequestValidator();
      const request = requestWithRuntimePart(
        validGetTodoRequest(),
        "param",
        param
      );

      const result = validator.safeValidate(request);

      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.pathParamIssues.length).toBeGreaterThan(0);
      expect(result.error.bodyIssues).toHaveLength(0);
      expect(result.error.headerIssues).toHaveLength(0);
      expect(result.error.queryIssues).toHaveLength(0);
    });

    test("strips unknown path parameters", () => {
      const validator = new GetTodoRequestValidator();
      const request = requestWithRuntimePart(validGetTodoRequest(), "param", {
        todoId: TODO_ID,
        extraParam: "strip me",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.param).toEqual({ todoId: TODO_ID });
    });

    test("does not unwrap array path parameter values", () => {
      const validator = new GetTodoRequestValidator();
      const request = requestWithRuntimePart(validGetTodoRequest(), "param", {
        todoId: [TODO_ID],
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(false);
      assert(!result.isValid);

      expect(issuePaths(result.error.pathParamIssues)).toContainEqual([
        "todoId",
      ]);
    });

    test("accepts a request whose path string and path parameters disagree", () => {
      const validator = new GetTodoRequestValidator();
      const request: IHttpRequest = {
        ...validGetTodoRequest(),
        path: `/todos/${OTHER_TODO_ID}`,
        param: { todoId: TODO_ID },
      };

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.path).toBe(`/todos/${OTHER_TODO_ID}`);
      expect(result.data.param).toEqual({ todoId: TODO_ID });
    });
  });

  describe("operations missing request parts", () => {
    test("ignores supplied bodies for bodyless operations", () => {
      const validator = new GetTodoRequestValidator();
      const request = requestWithRuntimePart(validGetTodoRequest(), "body", {
        title: "Ignored body",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect((result.data as IHttpRequest).body).toBeUndefined();
    });

    test("ignores supplied queries for queryless operations", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "query", {
        status: "DONE",
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect((result.data as IHttpRequest).query).toBeUndefined();
    });

    test("ignores supplied parameters for parameterless operations", () => {
      const validator = new CreateTodoRequestValidator();
      const request = requestWithRuntimePart(validCreateTodoRequest(), "param", {
        todoId: TODO_ID,
      });

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect((result.data as IHttpRequest).param).toBeUndefined();
    });

    test("returns undefined for absent query schemas", () => {
      const validator = new DeleteTodoRequestValidator();
      const request = validDeleteTodoRequest();

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect((result.data as IHttpRequest).query).toBeUndefined();
    });
  });

  describe("accumulated errors", () => {
    test("accumulates body, header, path parameter, and query issues", () => {
      const validator = new QuerySubTodoRequestValidator();
      const request = querySubTodoRequestWithInvalidBodyHeaderParamAndQuery();

      const result = validator.safeValidate(request);

      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(issuePaths(result.error.bodyIssues)).toEqual([["status"]]);
      expect(issuePaths(result.error.headerIssues)).toContainEqual(["Accept"]);
      expect(issuePaths(result.error.pathParamIssues)).toEqual([["todoId"]]);
      expect(issuePaths(result.error.queryIssues)).toEqual([["sortBy"]]);
    });

    test("does not expose partial validated data on failure", () => {
      const validator = new QuerySubTodoRequestValidator();
      const request = requestWithRuntimePart(validQuerySubTodoRequest(), "query", {
        format: "full",
      });

      const result = validator.safeValidate(request);

      expect(result.isValid).toBe(false);
      expect("data" in result).toBe(false);
    });
  });
});
