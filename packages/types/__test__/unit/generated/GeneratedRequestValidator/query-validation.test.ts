import assert from "node:assert";
import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import {
  ListSubTodosRequestValidator,
  ListTodosRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  AUTHORIZATION,
  issuePaths,
  requestWithRuntimePart,
  TODO_ID,
  validListTodosRequest,
} from "./fixtures.js";
import type { IListSubTodosRequest } from "test-utils";

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

const withoutRuntimePart = (
  request: IRawHttpRequest,
  part: "body" | "header" | "param" | "query"
): IRawHttpRequest => {
  const clone = { ...request };
  delete clone[part];
  return clone;
};

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
