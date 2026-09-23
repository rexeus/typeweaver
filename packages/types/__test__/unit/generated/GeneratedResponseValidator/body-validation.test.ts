import assert from "node:assert";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  CreateTodoResponseValidator,
  DeleteTodoResponseValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  asHttpResponse,
  expectNoPartialData,
  issuePaths,
  responseIssueFor,
  responseWithRuntimePart,
  validCreateTodoBody,
  validCreateTodoResponse,
  validDeleteTodoHeader,
  validDeleteTodoNoContentResponse,
  validDeleteTodoSuccessResponse,
  withoutRuntimePart,
} from "./fixtures.js";
import type { RuntimeResponse } from "./fixtures.js";
import type { IDeleteTodoBodyOnlyResponseBody } from "test-utils";

const validDeleteTodoBodyOnlyBody = (): IDeleteTodoBodyOnlyResponseBody => ({
  message: "Todo deleted",
});

const validDeleteTodoBodyOnlyResponse = (): RuntimeResponse => ({
  statusCode: HttpStatusCode.OK,
  body: validDeleteTodoBodyOnlyBody(),
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
