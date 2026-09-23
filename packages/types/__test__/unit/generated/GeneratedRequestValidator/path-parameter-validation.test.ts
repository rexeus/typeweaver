import assert from "node:assert";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import { GetTodoRequestValidator } from "test-utils";
import { describe, expect, test } from "vitest";
import {
  issuePaths,
  requestWithRuntimePart,
  TODO_ID,
  validGetTodoRequest,
} from "./fixtures.js";

const OTHER_TODO_ID = "01K0W0ZJA0DQE5D3CB5MP2FGKT";

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
