import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  InvalidResponseIssue,
} from "@rexeus/typeweaver-core";
import {
  CreateTodoResponseValidator,
  OptionsTodoResponseValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
  IOptionsTodoSuccessResponseHeader,
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

const validOptionsTodoHeader = (): IOptionsTodoSuccessResponseHeader => ({
  Allow: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  "Access-Control-Allow-Headers": ["Content-Type", "Authorization"],
  "Access-Control-Allow-Methods": [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],
  "Access-Control-Max-Age": "3600",
  "Access-Control-Allow-Origin": "*",
});

const validOptionsTodoResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.OK,
  header: validOptionsTodoHeader(),
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

describe("Generated ResponseValidator body shape contracts", () => {
  test("does not coerce body array fields from strings", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "body",
      {
        ...validCreateTodoBody(),
        tags: "contracts,validators",
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(
      issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
    ).toEqual(["tags"]);
  });

  test.each([
    { scenario: "null body", body: null },
    { scenario: "string body", body: "not an object" },
    { scenario: "number body", body: 123 },
    { scenario: "array body", body: [validCreateTodoBody()] },
  ])("rejects a malformed object body for $scenario", ({ body }) => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "body",
      body
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(
      responseIssueFor(result.error, "CreateTodoSuccess").bodyIssues.length
    ).toBeGreaterThan(0);
  });
});

describe("Generated ResponseValidator header casing", () => {
  test("returns schema-cased parsed headers for a valid response", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        "content-type": "application/json",
        "x-single-value": "request-1",
        "x-multi-value": ["alpha", "0"],
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header).toEqual(validCreateTodoHeader());
  });

  test("strips unknown response header keys", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Trace-Id": "trace-1",
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header).toEqual(validCreateTodoHeader());
    expect(result.data.header).not.toHaveProperty("X-Trace-Id");
  });

  test("normalizes case-insensitive header keys to schema casing", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        "CONTENT-TYPE": "application/json",
        "x-single-value": "request-1",
        "x-multi-value": ["alpha", "0"],
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header).toEqual(validCreateTodoHeader());
    expect(result.data.header).not.toHaveProperty("CONTENT-TYPE");
    expect(result.data.header).not.toHaveProperty("x-single-value");
    expect(result.data.header).not.toHaveProperty("x-multi-value");
  });
});

describe("Generated ResponseValidator header cardinality", () => {
  test("merges duplicate casing collisions for array header schemas", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "x-multi-value": ["beta", "1"],
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header["X-Multi-Value"]).toEqual([
      "alpha",
      "0",
      "beta",
      "1",
    ]);
    expect(result.data.header).not.toHaveProperty("x-multi-value");
  });

  test("wraps a single header value when the schema expects an array", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Multi-Value": "solo",
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header["X-Multi-Value"]).toEqual(["solo"]);
  });

  test("unwraps a single-element header array when the schema expects a scalar", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Single-Value": ["solo"],
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header["X-Single-Value"]).toBe("solo");
  });
});

describe("Generated ResponseValidator header string normalization", () => {
  test("rejects a multi-element header array when the schema expects a scalar", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Single-Value": ["one", "two"],
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(
      issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
    ).toEqual(["X-Single-Value"]);
  });

  test("splits comma-separated strings only for array header schema fields", () => {
    const validator = new OptionsTodoResponseValidator();
    const response = responseWithRuntimePart(
      validOptionsTodoResponse(),
      "header",
      {
        ...validOptionsTodoHeader(),
        Allow: " GET, ,0, OPTIONS, ",
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("OptionsTodoSuccess");
    assert(result.data.type === "OptionsTodoSuccess");
    expect(result.data.header.Allow).toEqual(["GET", "0", "OPTIONS"]);
  });

  test("does not split comma-separated strings for scalar header schema fields", () => {
    const validator = new OptionsTodoResponseValidator();
    const response = responseWithRuntimePart(
      validOptionsTodoResponse(),
      "header",
      {
        ...validOptionsTodoHeader(),
        "Access-Control-Allow-Origin":
          "https://one.example, https://two.example",
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("OptionsTodoSuccess");
    assert(result.data.type === "OptionsTodoSuccess");
    expect(result.data.header["Access-Control-Allow-Origin"]).toBe(
      "https://one.example, https://two.example"
    );
  });
});
