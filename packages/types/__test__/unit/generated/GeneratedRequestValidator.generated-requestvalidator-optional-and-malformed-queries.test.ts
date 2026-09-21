import assert from "node:assert";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import {
  CreateTodoRequestValidator,
  DeleteTodoRequestValidator,
  GetTodoRequestValidator,
  ListSubTodosRequestValidator,
  ListTodosRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  ICreateTodoRequest,
  IDeleteTodoRequest,
  IGetTodoRequest,
  IListSubTodosRequest,
  IListTodosRequest,
} from "test-utils";

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

const requestWithRuntimePart = (
  request: IRawHttpRequest,
  part: "body" | "header" | "param" | "query",
  value: unknown
): IRawHttpRequest => ({
  ...request,
  [part]: value,
});

const withoutRuntimePart = (
  request: IRawHttpRequest,
  part: "body" | "header" | "param" | "query"
): IRawHttpRequest => {
  const clone = { ...request };
  delete clone[part];
  return clone;
};

const issuePaths = (issues: RequestValidationError["bodyIssues"]) =>
  issues.map(issue => issue.path);

describe("Generated RequestValidator optional and malformed queries", () => {
  test.each([
    {
      scenario: "missing",
      request: withoutRuntimePart(validListTodosRequest(), "query"),
    },
    {
      scenario: "empty",
      request: requestWithRuntimePart(validListTodosRequest(), "query", {}),
    },
  ])(
    "accepts a $scenario query for an all-optional query schema",
    ({ request }) => {
      const validator = new ListTodosRequestValidator();

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.query).toEqual({});
    }
  );

  test("returns undefined for a missing optional query object", () => {
    const validator = new ListSubTodosRequestValidator();
    const request = withoutRuntimePart(validListSubTodosRequest(), "query");

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.query).toBeUndefined();
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

describe("Generated RequestValidator path parameter contracts", () => {
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

    expect(issuePaths(result.error.pathParamIssues)).toContainEqual(["todoId"]);
  });

  test("reports pathParamIssues when a required parameter is missing", () => {
    const validator = new GetTodoRequestValidator();
    const request = requestWithRuntimePart(validGetTodoRequest(), "param", {});

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(false);
    assert(!result.isValid);

    expect(issuePaths(result.error.pathParamIssues)).toContainEqual(["todoId"]);
  });

  test.each([
    { scenario: "null", param: null },
    { scenario: "primitive", param: "not params" },
    { scenario: "array", param: [TODO_ID] },
  ])(
    "reports pathParamIssues for a malformed $scenario parameter object",
    ({ param }) => {
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
    }
  );

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

    expect(issuePaths(result.error.pathParamIssues)).toContainEqual(["todoId"]);
  });

  test("accepts a request whose path string and path parameters disagree", () => {
    const validator = new GetTodoRequestValidator();
    const request: IRawHttpRequest = {
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

describe("Generated RequestValidator operations missing request parts", () => {
  test("ignores supplied bodies for bodyless operations", () => {
    const validator = new GetTodoRequestValidator();
    const request = requestWithRuntimePart(validGetTodoRequest(), "body", {
      title: "Ignored body",
    });

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.body).toBeUndefined();
  });

  test("ignores supplied queries for queryless operations", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "query", {
      status: "DONE",
    });

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.query).toBeUndefined();
  });

  test("ignores supplied parameters for parameterless operations", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "param", {
      todoId: TODO_ID,
    });

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.param).toBeUndefined();
  });

  test("returns undefined for absent query schemas", () => {
    const validator = new DeleteTodoRequestValidator();
    const request = validDeleteTodoRequest();

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.query).toBeUndefined();
  });
});
