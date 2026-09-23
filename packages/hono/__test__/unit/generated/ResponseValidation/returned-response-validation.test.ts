import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  aCreateTodoSuccessResponseWithBody,
  buildCreateTodoSuccess,
} from "../../../helpers.js";
import {
  captureResponseValidationHandlerCall,
  createCreateTodoRouteReturning,
  expectJson,
  expectSanitizedInternalServerError,
  requestCreateTodo,
} from "./fixtures.js";

describe("returned response body validation", () => {
  test("strips extra body fields from a valid returned response", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-be-stripped",
      anotherExtra: 42,
    });
    const app = createCreateTodoRouteReturning(responseWithExtra);

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data).not.toHaveProperty("anotherExtra");
    expect(data["id"]).toBe(responseWithExtra.body.id);
    expect(data["title"]).toBe(responseWithExtra.body.title);
  });

  test("returns a sanitized 500 when a returned response body has invalid field types", async () => {
    const invalidResponse = aCreateTodoSuccessResponseWithBody({
      id: 12345,
      title: true,
      secret: "response-secret",
    });
    const app = createCreateTodoRouteReturning(invalidResponse);

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    const serializedError = JSON.stringify(data);
    expect(serializedError).not.toContain("response-secret");
    expect(serializedError).not.toContain("12345");
  });

  test.each([
    { scenario: "undefined", body: undefined },
    { scenario: "null", body: null },
    { scenario: "empty object", body: {} },
  ])(
    "returns a sanitized 500 when a returned response body is $scenario",
    async ({ body }) => {
      const app = createCreateTodoRouteReturning(
        aCreateTodoSuccessResponseWithBody(body)
      );

      const response = await requestCreateTodo(app);

      await expectSanitizedInternalServerError(response);
    }
  );
});

describe("returned response header validation", () => {
  test("strips unknown response headers after validation", async () => {
    const responseWithUnknownHeader: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "Content-Type": "application/json",
        "X-Trace-Id": "trace-1",
      },
    };
    const app = createCreateTodoRouteReturning(responseWithUnknownHeader);

    const response = await requestCreateTodo(app);

    await expectJson(response, 201);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-trace-id")).toBeNull();
  });

  test("coerces schema response headers before serialization", async () => {
    const responseWithCoercibleHeaders: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "content-type": "application/json",
        "X-Single-Value": ["single"],
        "X-Multi-Value": "first, second",
      },
    };
    const app = createCreateTodoRouteReturning(responseWithCoercibleHeaders);

    const response = await requestCreateTodo(app);

    await expectJson(response, 201);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-single-value")).toBe("single");
    expect(response.headers.get("x-multi-value")).toBe("first, second");
  });

  test("returns a sanitized 500 when a required response header is invalid", async () => {
    const responseWithInvalidHeader: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: { "Content-Type": "text/plain" },
    };
    const app = createCreateTodoRouteReturning(responseWithInvalidHeader);

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    expect(JSON.stringify(data)).not.toContain("text/plain");
  });
});

describe("response status validation", () => {
  test("returns a sanitized 500 when a returned response has an unrecognized status code", async () => {
    const unknownStatusResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 299 as HttpStatusCode,
      header: { "Content-Type": "application/json" },
      body: { message: "unexpected" },
    };
    const app = createCreateTodoRouteReturning(unknownStatusResponse);

    const response = await requestCreateTodo(app);

    await expectSanitizedInternalServerError(response);
  });

  test("passes status validation details to a custom response-validation handler", async () => {
    const { handler, getCapturedCall } = captureResponseValidationHandlerCall();
    const unknownStatusResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 299 as HttpStatusCode,
      header: { "Content-Type": "application/json" },
      body: { message: "unexpected" },
    };
    const app = createCreateTodoRouteReturning(unknownStatusResponse, {
      handleResponseValidationErrors: handler,
    });

    const response = await requestCreateTodo(app);

    await expectJson(response, 502);
    const capturedCall = getCapturedCall();
    assert(capturedCall.error instanceof ResponseValidationError);
    const statusIssue = capturedCall.error.issues.find(
      issue => issue.type === "INVALID_STATUS_CODE"
    );
    assert(statusIssue?.type === "INVALID_STATUS_CODE");
    expect(statusIssue.invalidStatusCode).toBe(299);
    expect(statusIssue.expectedStatusCodes).toEqual([
      201, 400, 401, 403, 415, 429, 500,
    ]);
    expect(capturedCall.operationId).toBe("CreateTodo");
  });
});
