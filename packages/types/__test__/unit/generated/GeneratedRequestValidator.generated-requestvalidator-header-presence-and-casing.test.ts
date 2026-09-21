import assert from "node:assert";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import {
  CreateTodoRequestValidator,
  ListTodosRequestValidator,
  OptionsTodoRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  ICreateTodoRequest,
  IListTodosRequest,
  IOptionsTodoRequest,
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

describe("Generated RequestValidator header presence and casing", () => {
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
});

describe("Generated RequestValidator header cardinality", () => {
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
});

describe("Generated RequestValidator duplicate headers", () => {
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
    const request = requestWithRuntimePart(
      validOptionsTodoRequest(),
      "header",
      {
        Accept: "application/json",
        Authorization: AUTHORIZATION,
        "Access-Control-Request-Headers": "Content-Type",
        "access-control-request-headers": "Authorization",
      }
    );

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.header["Access-Control-Request-Headers"]).toEqual([
      "Content-Type",
      "Authorization",
    ]);
  });
});

describe("Generated RequestValidator array header normalization", () => {
  test("splits comma-separated strings only for array header fields", () => {
    const validator = new OptionsTodoRequestValidator();
    const request = requestWithRuntimePart(
      validOptionsTodoRequest(),
      "header",
      {
        Accept: "application/json",
        Authorization: "Bearer token,with-comma",
        "Access-Control-Request-Headers": " Content-Type, , Authorization, ",
      }
    );

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
    const request = requestWithRuntimePart(
      validOptionsTodoRequest(),
      "header",
      {
        Accept: "application/json",
        Authorization: AUTHORIZATION,
        "Access-Control-Request-Headers": ["Content-Type, Authorization"],
      }
    );

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

describe("Generated RequestValidator query cardinality", () => {
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
});
