import assert from "node:assert";
import {
  internalServerErrorDefaultError,
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createCreateTodoSuccessResponseBody,
  createTestHono,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  aCreateTodoSuccessResponseWithBody,
  buildCreateTodoSuccess,
  expectErrorResponse,
  prepareRequestData,
} from "../../helpers.js";

describe("Response Validation (Hono)", () => {
  describe("field stripping", () => {
    test("strips extra body fields from a valid response", async () => {
      const responseWithExtra = buildCreateTodoSuccess({
        extraField: "should-be-stripped",
        anotherExtra: 42,
      });
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: responseWithExtra,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).not.toHaveProperty("extraField");
      expect(data).not.toHaveProperty("anotherExtra");
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
    });

    test("preserves all schema-defined fields after stripping", async () => {
      const body = createCreateTodoSuccessResponseBody();
      const responseWithExtra = buildCreateTodoSuccess({
        ...body,
        extraField: "noise",
      });
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: responseWithExtra,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.id).toBe(body.id);
      expect(data.accountId).toBe(body.accountId);
      expect(data.title).toBe(body.title);
      expect(data.status).toBe(body.status);
      expect(data.createdAt).toBe(body.createdAt);
      expect(data.modifiedAt).toBe(body.modifiedAt);
      expect(data.createdBy).toBe(body.createdBy);
      expect(data.modifiedBy).toBe(body.modifiedBy);
    });
  });

  describe("invalid response handling", () => {
    test("returns sanitized 500 when response body has wrong field types", async () => {
      const invalidResponse = aCreateTodoSuccessResponseWithBody({
        id: 12345,
        title: true,
      });
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      const data = await expectErrorResponse(
        response,
        internalServerErrorDefaultError.statusCode,
        internalServerErrorDefaultError.code
      );
      expect(data.message).toBe(internalServerErrorDefaultError.message);
    });

    test("returns sanitized 500 when response has unrecognized status code", async () => {
      const unknownStatusResponse: ITypedHttpResponse = {
        type: "UnknownResponse" as const,
        statusCode: 299 as HttpStatusCode,
        header: { "Content-Type": "application/json" },
        body: { message: "unexpected" },
      };
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: unknownStatusResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });
  });

  describe("custom handleResponseValidationErrors hook", () => {
    test("passes response validation details and Hono context to custom handlers", async () => {
      const handler = vi.fn<
        import("test-utils").HonoResponseValidationErrorHandler
      >(() => ({
        statusCode: 502,
        body: { code: "CUSTOM_VALIDATION_FAILURE", detail: "body mismatch" },
      }));
      const invalidResponse = aCreateTodoSuccessResponseWithBody({ id: 12345 });
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: handler,
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(502);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("CUSTOM_VALIDATION_FAILURE");

      expect(handler).toHaveBeenCalledOnce();
      const args = handler.mock.calls[0]!;
      assert(args[0] instanceof ResponseValidationError);
      expect(args[1]).toBe(invalidResponse);
      expect(args[2].get("operationId")).toBe("CreateTodo");
    });

    test("returns the custom handler's response to the client", async () => {
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: () => ({
          statusCode: 503,
          header: { "X-Custom": "response-validation" },
          body: { reason: "schema mismatch" },
        }),
        throwTodoError: aCreateTodoSuccessResponseWithBody({ id: 999 }),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(503);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.reason).toBe("schema mismatch");
      expect(response.headers.get("X-Custom")).toBe("response-validation");
    });
  });

  describe("validateResponses: false", () => {
    test("passes through extra body fields when validation is disabled", async () => {
      const responseWithExtra = buildCreateTodoSuccess({
        extraField: "should-remain",
        secretData: { nested: true },
      });
      const app = createTestHono({
        validateResponses: false,
        throwTodoError: responseWithExtra,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.extraField).toBe("should-remain");
      expect(data.secretData).toEqual({ nested: true });
    });

    test("passes through invalid response types when validation is disabled", async () => {
      const invalidResponse = aCreateTodoSuccessResponseWithBody({
        id: 12345,
        title: true,
      });
      const app = createTestHono({
        validateResponses: false,
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.id).toBe(12345);
      expect(data.title).toBe(true);
    });
  });

  describe("thrown typed responses", () => {
    test("strips extra fields from thrown typed responses", async () => {
      const thrownResponse = buildCreateTodoSuccess({
        extraField: "thrown-extra",
      });
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: thrownResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).not.toHaveProperty("extraField");
      expect(data.id).toBeDefined();
    });

    test("returns sanitized 500 for thrown typed response with invalid body", async () => {
      const thrownInvalid = aCreateTodoSuccessResponseWithBody({
        wrongField: "completely wrong structure",
      });
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: thrownInvalid,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });
  });

  describe("handleResponseValidationErrors: false (pass-through mode)", () => {
    test("returns the invalid response as-is when response validation handling is disabled", async () => {
      const invalidResponse = aCreateTodoSuccessResponseWithBody({
        id: 12345,
        title: true,
      });
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: false,
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.id).toBe(12345);
      expect(data.title).toBe(true);
    });

    test("still strips extra fields from valid responses when response validation handling is disabled", async () => {
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: false,
        throwTodoError: buildCreateTodoSuccess({
          extraField: "should-strip",
        }),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).not.toHaveProperty("extraField");
      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
    });
  });

  describe("custom handler error recovery", () => {
    test("returns sanitized 500 without leaking the invalid response when custom handler throws", async () => {
      const invalidResponse = aCreateTodoSuccessResponseWithBody({ id: 12345 });
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: () => {
          throw new Error("handler crashed");
        },
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      const data = await expectErrorResponse(
        response,
        500,
        "INTERNAL_SERVER_ERROR"
      );
      expect(data).not.toHaveProperty("id");
    });

    test("returns sanitized 500 without leaking the invalid response when async custom handler rejects", async () => {
      const invalidResponse = aCreateTodoSuccessResponseWithBody({ id: 12345 });
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: async () => {
          throw new Error("async crash");
        },
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      const data = await expectErrorResponse(
        response,
        500,
        "INTERNAL_SERVER_ERROR"
      );
      expect(data).not.toHaveProperty("id");
    });
  });

  describe("non-typed errors with validateResponses enabled", () => {
    test("routes non-typed errors to error handler, not response validation", async () => {
      // Arrange
      const plainError = new Error("handler crashed");
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: plainError,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });
  });

  describe("edge cases", () => {
    test("returns sanitized 500 for response with undefined body", async () => {
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: aCreateTodoSuccessResponseWithBody(undefined),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });

    test("returns sanitized 500 for response with null body", async () => {
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: aCreateTodoSuccessResponseWithBody(null),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });

    test("returns sanitized 500 for response with empty object body", async () => {
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: aCreateTodoSuccessResponseWithBody({}),
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      await expectErrorResponse(response, 500, "INTERNAL_SERVER_ERROR");
    });
  });
});
