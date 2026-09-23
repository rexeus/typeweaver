import assert from "node:assert";
import { HttpMethod, RequestValidationError } from "@rexeus/typeweaver-core";
import type { IRawHttpRequest } from "@rexeus/typeweaver-core";
import {
  captureError,
  CreateTodoRequestValidator,
  DeleteTodoRequestValidator,
  GetMetricRequestValidator,
  GetTodoRequestValidator,
  ListTodosRequestValidator,
  QuerySubTodoRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  AUTHORIZATION,
  issuePaths,
  querySubTodoRequestWithInvalidBodyHeaderParamAndQuery,
  requestWithRuntimePart,
  TODO_ID,
  validCreateTodoRequest,
  validGetTodoRequest,
  validListTodosRequest,
  validQuerySubTodoRequest,
} from "./fixtures.js";
import type { IDeleteTodoRequest, IGetMetricRequest } from "test-utils";

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

describe("Generated RequestValidator accumulated errors", () => {
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
    const request = requestWithRuntimePart(
      validQuerySubTodoRequest(),
      "query",
      {
        format: "full",
      }
    );

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    expect("data" in result).toBe(false);
  });
});

describe("Generated RequestValidator typed HTTP boundary coercion", () => {
  const validRawMetricRequest = (): IRawHttpRequest => ({
    method: HttpMethod.GET,
    path: "/metrics/42",
    param: { metricId: "42" },
    query: {
      enabled: "false",
      truthy: "false",
      capturedAt: "2026-07-26T10:15:30.000Z",
      samples: ["1.5", "2"],
    },
    header: {
      "x-attempt": "3",
      "x-enabled": "false",
      "x-flags": "false, true",
      "x-note": "first, second",
      "x-observed-at": "2026-07-26T10:15:30.000Z",
    },
  });

  test("returns exact Zod output while preserving Zod boolean semantics", () => {
    const result = new GetMetricRequestValidator().safeValidate(
      validRawMetricRequest()
    );

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual<IGetMetricRequest>({
      method: HttpMethod.GET,
      path: "/metrics/42",
      param: { metricId: 42 },
      query: {
        enabled: false,
        truthy: true,
        capturedAt: new Date("2026-07-26T10:15:30.000Z"),
        samples: [1.5, 2],
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Flags": [false, true],
        "X-Note": "first, second",
        "X-Observed-At": new Date("2026-07-26T10:15:30.000Z"),
      },
    });
  });

  test("normalizes a singleton query value for an array schema", () => {
    const request = requestWithRuntimePart(validRawMetricRequest(), "query", {
      samples: "7",
    });

    const result = new GetMetricRequestValidator().safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.query.samples).toEqual([7]);
  });

  test("rejects repeated raw values for a scalar query schema", () => {
    const request = requestWithRuntimePart(validRawMetricRequest(), "query", {
      truthy: ["false", "true"],
    });

    const result = new GetMetricRequestValidator().safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.queryIssues)).toContainEqual(["truthy"]);
  });

  test("rejects an invalid numeric path before handler dispatch", () => {
    const request = requestWithRuntimePart(validRawMetricRequest(), "param", {
      metricId: "not-a-number",
    });

    const result = new GetMetricRequestValidator().safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.pathParamIssues)).toContainEqual([
      "metricId",
    ]);
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
