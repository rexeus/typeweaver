import assert from "node:assert";
import {
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
import { buildCreateTodoSuccess, prepareRequestData } from "../../helpers";

describe("Response Validation (Hono)", () => {
  describe("field stripping", () => {
    test("should strip extra body fields from a valid response", async () => {
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

    test("should preserve all schema-defined fields after stripping", async () => {
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
    test("should return 500 when response body has wrong field types", async () => {
      const invalidResponse: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: {
          id: 12345,
          title: true,
        },
      };
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: invalidResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should return 500 when response has unrecognized status code", async () => {
      const unknownStatusResponse: ITypedHttpResponse = {
        type: "UnknownResponse" as const,
        statusCode: 299 as unknown as HttpStatusCode,
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

      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("custom handleResponseValidationErrors hook", () => {
    test("should call custom handler with error, response, and context", async () => {
      const handler = vi.fn<
        import("test-utils").HonoResponseValidationErrorHandler
      >(() => ({
        statusCode: 502,
        body: { code: "CUSTOM_VALIDATION_FAILURE", detail: "body mismatch" },
      }));
      const invalidResponse: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: 12345 },
      };
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
      expect(args[1]!.statusCode).toBe(201);
      expect(args[2]).toBeDefined();
    });

    test("should send the custom handler's response to the client", async () => {
      const app = createTestHono({
        validateResponses: true,
        handleResponseValidationErrors: () => ({
          statusCode: 503,
          header: { "X-Custom": "response-validation" },
          body: { reason: "schema mismatch" },
        }),
        throwTodoError: {
          type: "CreateTodoSuccess" as const,
          statusCode: 201,
          header: { "Content-Type": "application/json" },
          body: { id: 999 },
        } satisfies ITypedHttpResponse,
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
    test("should pass through extra body fields when validation is disabled", async () => {
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

    test("should pass through invalid response types when validation is disabled", async () => {
      const invalidResponse: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: 12345, title: true },
      };
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
    test("should strip extra fields from thrown typed responses", async () => {
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

    test("should return 500 for thrown typed response with invalid body", async () => {
      const thrownInvalid: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { wrongField: "completely wrong structure" },
      };
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: thrownInvalid,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("handleResponseValidationErrors: false (pass-through mode)", () => {
    test("should return the invalid response as-is when handleResponseValidationErrors is false", async () => {
      const invalidResponse: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: {
          id: 12345,
          title: true,
        },
      };
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

    test("should still strip extra fields from valid responses when handleResponseValidationErrors is false", async () => {
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
    test("should fall back to original response when custom handler throws", async () => {
      const invalidResponse: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: 12345 },
      };
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

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).toEqual({ id: 12345 });
    });

    test("should fall back to original response when async custom handler rejects", async () => {
      const invalidResponse: ITypedHttpResponse = {
        type: "CreateTodoSuccess" as const,
        statusCode: 201,
        header: { "Content-Type": "application/json" },
        body: { id: 12345 },
      };
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

      expect(response.status).toBe(201);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data).toEqual({ id: 12345 });
    });
  });

  describe("non-typed errors with validateResponses enabled", () => {
    test("should route non-typed errors to error handler, not response validation", async () => {
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
      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("edge cases", () => {
    test("should handle response with undefined body", async () => {
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: {
          type: "CreateTodoSuccess" as const,
          statusCode: 201,
          header: { "Content-Type": "application/json" },
          body: undefined,
        } satisfies ITypedHttpResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should handle response with null body", async () => {
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: {
          type: "CreateTodoSuccess" as const,
          statusCode: 201,
          header: { "Content-Type": "application/json" },
          body: null,
        } satisfies ITypedHttpResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should handle response with empty object body", async () => {
      const app = createTestHono({
        validateResponses: true,
        throwTodoError: {
          type: "CreateTodoSuccess" as const,
          statusCode: 201,
          header: { "Content-Type": "application/json" },
          body: {},
        } satisfies ITypedHttpResponse,
      });
      const requestData = createCreateTodoRequest();

      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      expect(response.status).toBe(500);
      const data = (await response.json()) as Record<string, unknown>;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
