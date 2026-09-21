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
  DeleteTodoResponseValidator,
  OptionsTodoResponseValidator,
  ResponseValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import type {
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
  IDeleteTodoBodyOnlyResponseBody,
  IDeleteTodoSuccessResponseHeader,
  IOptionsTodoSuccessResponseHeader,
  ResponseEntry,
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

const validDeleteTodoHeader = (): IDeleteTodoSuccessResponseHeader => ({
  "Content-Type": "application/json",
  "X-Single-Value": "delete-1",
  "X-Multi-Value": ["deleted"],
});

const validDeleteTodoSuccessResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.NO_CONTENT,
  header: validDeleteTodoHeader(),
});

const validDeleteTodoBodyOnlyBody = (): IDeleteTodoBodyOnlyResponseBody => ({
  message: "Todo deleted",
});

const validDeleteTodoBodyOnlyResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.OK,
  body: validDeleteTodoBodyOnlyBody(),
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

describe("Generated ResponseValidator malformed and duplicate headers", () => {
  test("does not re-split header values that are already arrays", () => {
    const validator = new OptionsTodoResponseValidator();
    const response = responseWithRuntimePart(
      validOptionsTodoResponse(),
      "header",
      {
        ...validOptionsTodoHeader(),
        Allow: ["GET,POST", "OPTIONS"],
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("OptionsTodoSuccess");
    assert(result.data.type === "OptionsTodoSuccess");
    expect(result.data.header.Allow).toEqual(["GET,POST", "OPTIONS"]);
  });

  test.each([
    { scenario: "null header", header: null },
    { scenario: "primitive header", header: "not an object" },
    { scenario: "array header", header: [validCreateTodoHeader()] },
  ])(
    "rejects a malformed required header shape for $scenario",
    ({ header }) => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        header
      );

      const result = validator.safeValidate(asHttpResponse(response));

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").headerIssues.length
      ).toBeGreaterThan(0);
    }
  );

  test("reports a missing required header part without a status-code issue", () => {
    const validator = new CreateTodoResponseValidator();
    const response = withoutRuntimePart(validCreateTodoResponse(), "header");

    const result = validator.safeValidate(asHttpResponse(response));

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.hasStatusCodeIssues()).toBe(false);
    expect(
      responseIssueFor(result.error, "CreateTodoSuccess").headerIssues.length
    ).toBeGreaterThan(0);
    expect(
      responseIssueFor(result.error, "CreateTodoSuccess").bodyIssues
    ).toHaveLength(0);
  });

  test("rejects duplicate casing collisions for singleton header schemas", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "content-type": "application/json",
      }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(
      issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
    ).toEqual(["Content-Type"]);
  });
});

describe("Generated ResponseValidator bodyless and headerless contracts", () => {
  test("validates header-only responses and strips an unexpected body", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = responseWithRuntimePart(
      validDeleteTodoSuccessResponse(),
      "body",
      { ignored: true }
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual({
      type: "DeleteTodoSuccess",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: validDeleteTodoHeader(),
      body: undefined,
    });
  });

  test("validates body-only responses and strips an unexpected header", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = responseWithRuntimePart(
      validDeleteTodoBodyOnlyResponse(),
      "header",
      validDeleteTodoHeader()
    );

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual({
      type: "DeleteTodoBodyOnly",
      statusCode: HttpStatusCode.OK,
      header: undefined,
      body: validDeleteTodoBodyOnlyBody(),
    });
  });

  test("validates headerless bodyless responses and ignores unexpected payload parts", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = {
      ...validDeleteTodoNoContentResponse(),
      header: { "X-Ignored": "true" },
      body: { ignored: true },
    };

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual({
      type: "DeleteTodoNoContent",
      statusCode: HttpStatusCode.NO_CONTENT,
      header: undefined,
      body: undefined,
    });
  });
});

describe("Generated ResponseValidator duplicate status-code fallthrough", () => {
  // Local concrete validator exercises abstract duplicate-status dispatch
  // without regenerating fixtures.
  class DuplicateStatusCodeValidator extends ResponseValidator {
    protected override readonly expectedStatusCodes = [200];
    protected override readonly responseEntries: readonly ResponseEntry[] = [
      {
        name: "NarrowSuccess",
        statusCode: 200,
        headerSchema: undefined,
        bodySchema: z.object({
          variant: z.literal("narrow"),
          data: z.string(),
        }),
      },
      {
        name: "WideSuccess",
        statusCode: 200,
        headerSchema: undefined,
        bodySchema: z.object({
          variant: z.literal("wide"),
          count: z.number(),
        }),
      },
    ];
  }

  test("matches the header-required 204 response when its header is valid", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = validDeleteTodoSuccessResponse();

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("DeleteTodoSuccess");
    expect(result.data.header).toEqual(validDeleteTodoHeader());
  });

  test("falls through to the headerless 204 response when the header is absent", () => {
    const validator = new DeleteTodoResponseValidator();
    const response = validDeleteTodoNoContentResponse();

    const result = validator.safeValidate(asHttpResponse(response));

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("DeleteTodoNoContent");
  });

  test("accumulates response issues without a status-code issue when duplicate status variants do not match", () => {
    const validator = new DuplicateStatusCodeValidator();
    const response = {
      statusCode: 200,
      body: { variant: "unknown" },
    };

    const result = validator.safeValidate(asHttpResponse(response));

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.hasStatusCodeIssues()).toBe(false);
    expect(result.error.issues.map(issue => issue.type)).toEqual([
      "INVALID_RESPONSE",
      "INVALID_RESPONSE",
    ]);
    expect(
      responseIssueFor(result.error, "NarrowSuccess").bodyIssues.length
    ).toBeGreaterThan(0);
    expect(
      responseIssueFor(result.error, "WideSuccess").bodyIssues.length
    ).toBeGreaterThan(0);
  });
});
