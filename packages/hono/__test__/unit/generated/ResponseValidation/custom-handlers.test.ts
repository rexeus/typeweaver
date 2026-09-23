import assert from "node:assert";
import { ResponseValidationError } from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { TestApplicationError } from "test-utils";
import { describe, expect, test } from "vitest";
import { aCreateTodoSuccessResponseWithBody } from "../../../helpers.js";
import {
  captureResponseValidationHandlerCall,
  createCreateTodoRouteReturning,
  expectJson,
  expectSanitizedInternalServerError,
  requestCreateTodo,
} from "./fixtures.js";
import type { HonoResponseValidationErrorHandler } from "test-utils";

describe("custom response-validation handlers", () => {
  test("passes normalized invalid responses and Hono context to custom handlers", async () => {
    const invalidBody = { id: 12345, title: true };
    const { handler, getCapturedCall } = captureResponseValidationHandlerCall();
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: {
        "Content-Type": "application/json",
        "X-Single-Value": "defined",
        "X-Multi-Value": undefined,
        "X-Trace-Id": "trace-1",
      },
      body: invalidBody,
    };
    const app = createCreateTodoRouteReturning(invalidResponse, {
      handleResponseValidationErrors: handler,
    });

    const response = await requestCreateTodo(app);

    await expectJson(response, 502);
    const capturedCall = getCapturedCall();
    assert(capturedCall.error instanceof ResponseValidationError);
    expect(capturedCall.response).not.toHaveProperty("type");
    expect(capturedCall.response.header).toEqual({
      "Content-Type": "application/json",
      "X-Single-Value": "defined",
      "X-Trace-Id": "trace-1",
    });
    expect(capturedCall.response.body).toEqual(invalidBody);
    expect(capturedCall.operationId).toBe("CreateTodo");
  });

  test("returns the custom handler response to the client", async () => {
    const handler: HonoResponseValidationErrorHandler = () => ({
      statusCode: 503,
      header: { "X-Custom": "response-validation" },
      body: { reason: "schema mismatch" },
    });
    const app = createCreateTodoRouteReturning(
      aCreateTodoSuccessResponseWithBody({ id: 999 }),
      { handleResponseValidationErrors: handler }
    );

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 503);
    expect(data["reason"]).toBe("schema mismatch");
    expect(response.headers.get("x-custom")).toBe("response-validation");
  });

  test("fails closed with a sanitized 500 when the custom handler throws", async () => {
    const handler: HonoResponseValidationErrorHandler = () => {
      throw new TestApplicationError("handler crashed");
    };
    const app = createCreateTodoRouteReturning(
      aCreateTodoSuccessResponseWithBody({
        id: 12345,
        secret: "handler-throw-secret",
      }),
      { handleResponseValidationErrors: handler }
    );

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    expect(JSON.stringify(data)).not.toContain("handler-throw-secret");
  });

  test("fails closed with a sanitized 500 when the custom handler rejects", async () => {
    const handler: HonoResponseValidationErrorHandler = async () => {
      throw new TestApplicationError("async handler crashed");
    };
    const app = createCreateTodoRouteReturning(
      aCreateTodoSuccessResponseWithBody({
        id: 12345,
        secret: "handler-reject-secret",
      }),
      { handleResponseValidationErrors: handler }
    );

    const response = await requestCreateTodo(app);

    const data = await expectSanitizedInternalServerError(response);
    expect(JSON.stringify(data)).not.toContain("handler-reject-secret");
  });
});
