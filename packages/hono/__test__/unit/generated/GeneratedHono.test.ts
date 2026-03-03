import { HttpResponse } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createHeadTodoRequest,
  createListTodosRequest,
  createOptionsTodoRequest,
  createTestHono,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
  TodoHono,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type {
  HonoTodoApiHandler,
  IValidationErrorResponseBody,
} from "test-utils";

function prepareRequestData(requestData: IHttpRequest): RequestInit {
  const body =
    typeof requestData.body === "string"
      ? requestData.body
      : requestData.body
        ? JSON.stringify(requestData.body)
        : undefined;

  const headers: Headers = new Headers();
  for (const [key, value] of Object.entries(requestData.header || {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }
  return {
    method: requestData.method,
    headers,
    body,
  };
}

describe("Generated Hono Router", () => {
  describe("Operation Registration & Handling", () => {
    test("should register and handle GET operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createListTodosRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos?status=TODO",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle POST operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle PUT operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createUpdateTodoStatusRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}/status`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle DELETE operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createDeleteTodoRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(204);
      const data = await response.text();
      expect(data).toBe(""); // DELETE should have no content
    });

    test("should register and handle PATCH operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createUpdateTodoRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle OPTIONS operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createOptionsTodoRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get("Allow")).toBeDefined();
    });

    test("should register and handle HEAD operations", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createHeadTodoRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(""); // HEAD should have empty body
    });
  });

  describe("Request Validation", () => {
    test("should validate valid requests successfully", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should reject invalid request body", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.body).toHaveLength(1);
    });

    test("should reject invalid request headers", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest({
        header: {
          "Content-Type": "text/plain" as any, // Invalid content type
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.header).toHaveLength(1);
    });

    test("should reject invalid path parameters", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createUpdateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos/invalid-uuid-format",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.param).toHaveLength(1);
    });

    test("should reject invalid query parameters", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createListTodosRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos?status=INVALID_STATUS",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.query).toHaveLength(1);
    });

    test("should bypass validation when validateRequests is disabled", async () => {
      // Arrange
      const app = createTestHono({
        validateRequests: false,
      });
      const requestData = createCreateTodoRequest({
        body: {
          title: "", // Empty title is invalid
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should use custom validation error handler when provided", async () => {
      // Arrange
      const customValidationMessage = "Custom validation error";
      const app = createTestHono({
        handleValidationErrors: () => {
          return new HttpResponse(
            400,
            {
              "Content-Type": "application/json",
            },
            {
              message: customValidationMessage,
            }
          );
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const errorData = (await response.json()) as any;
      expect(errorData.message).toBe(customValidationMessage);
    });
  });

  describe("Response Handling", () => {
    test("should handle JSON response bodies", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const data = (await response.json()) as any;
      expect(data).toBeDefined();
      expect(typeof data).toBe("object");
      expect(data.id).toBeDefined();
      expect(data.title).toBe(requestData.body.title);
    });

    test("should handle string response bodies", async () => {
      // Arrange
      const customStringResponse = "This is a plain text response";
      const app = createTestHono({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "text/plain" },
          customStringResponse
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(customStringResponse);
    });

    test("should handle ArrayBuffer response bodies", async () => {
      // Arrange
      const content = "binary content";
      const arrayBuffer = new TextEncoder().encode(content).buffer;
      const app = createTestHono({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "application/octet-stream" },
          arrayBuffer
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const buffer = await response.arrayBuffer();
      const decoded = new TextDecoder().decode(buffer);
      expect(decoded).toBe(content);
    });

    test("should handle Blob response bodies", async () => {
      // Arrange
      const content = "blob content";
      const blob = new Blob([content], { type: "text/plain" });
      const app = createTestHono({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "text/plain" },
          blob
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(content);
    });

    test("should handle FormData response bodies", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("name", "typeweaver");
      formData.append("version", "1.0");
      const app = createTestHono({
        throwTodoError: new HttpResponse(200, {}, formData),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const result = await response.formData();
      expect(result.get("name")).toBe("typeweaver");
      expect(result.get("version")).toBe("1.0");
    });

    test("should handle URLSearchParams response bodies", async () => {
      // Arrange
      const params = new URLSearchParams();
      params.append("key", "value");
      params.append("foo", "bar");
      const app = createTestHono({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "application/x-www-form-urlencoded" },
          params
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("key=value&foo=bar");
    });

    test("should handle ReadableStream response bodies", async () => {
      // Arrange
      const encoder = new TextEncoder();
      async function* generate() {
        yield encoder.encode("hello ");
        yield encoder.encode("world");
      }
      const stream = ReadableStream.from(generate());
      const app = createTestHono({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "text/plain" },
          stream
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("hello world");
    });

    test("should handle ArrayBufferView response bodies", async () => {
      // Arrange
      const content = "uint8 content";
      const uint8Array = new TextEncoder().encode(content);
      const app = createTestHono({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "application/octet-stream" },
          uint8Array
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(content);
    });

    test("should handle empty response bodies", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createDeleteTodoRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(204);
      const text = await response.text();
      expect(text).toBe("");
    });

    test("should handle single-value response headers", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    test("should handle multi-value response headers", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createOptionsTodoRequest();

      // Act
      const response = await app.request(
        `http://localhost/todos/${requestData.param.todoId}`,
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(200);

      const allowHeader = response.headers.get("Allow");
      expect(allowHeader).toBeDefined();
      expect(allowHeader).toBe("GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    });
  });

  describe("Route Metadata (operationId)", () => {
    test("should set operationId on Hono context before handler runs", async () => {
      let capturedOperationId: string | undefined;

      const stubHandlers = new Proxy({} as HonoTodoApiHandler, {
        get: (_target, prop) => {
          if (prop === "handleListTodosRequest") {
            return async (_req: any, context: any) => {
              capturedOperationId = context.get("operationId");
              return { statusCode: 200, body: [] };
            };
          }
          return async () => ({ statusCode: 200 });
        },
      });

      const app = new TodoHono({
        requestHandlers: stubHandlers,
        validateRequests: false,
      });

      const response = await app.request("http://localhost/todos?status=TODO", {
        method: "GET",
      });

      expect(response.status).toBe(200);
      expect(capturedOperationId).toBe("ListTodos");
    });

    test("should set different operationId per route", async () => {
      const capturedIds: string[] = [];

      const stubHandlers = new Proxy({} as HonoTodoApiHandler, {
        get: () => async (_req: any, context: any) => {
          capturedIds.push(context.get("operationId"));
          return { statusCode: 200, body: {} };
        },
      });

      const app = new TodoHono({
        requestHandlers: stubHandlers,
        validateRequests: false,
      });

      await app.request("http://localhost/todos", { method: "GET" });
      await app.request("http://localhost/todos", { method: "POST" });
      await app.request("http://localhost/todos/t1", { method: "GET" });

      expect(capturedIds).toEqual(["ListTodos", "CreateTodo", "GetTodo"]);
    });
  });

  describe("Error Handling", () => {
    test("should handle HTTP response errors with default handler", async () => {
      // Arrange
      const errorResponse = new HttpResponse(
        404,
        {},
        {
          errorCode: "TODO_NOT_FOUND",
        }
      );
      const app = createTestHono({
        throwTodoError: errorResponse,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.errorCode).toBe("TODO_NOT_FOUND");
    });

    test("should handle HTTP response errors with custom handler", async () => {
      // Arrange
      const errorResponse = new HttpResponse(
        404,
        {},
        {
          errorCode: "TODO_NOT_FOUND",
        }
      );
      const customMessage = "Custom error handling";
      const app = createTestHono({
        throwTodoError: errorResponse,
        handleHttpResponseErrors: (error: HttpResponse) => {
          return new HttpResponse(
            404,
            {},
            {
              ...error.body.customError,
              customMessage,
            }
          );
        },
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.customMessage).toBe(customMessage);
    });

    test("should handle validation errors with default handler", async () => {
      // Arrange
      const app = createTestHono();
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority to trigger validation error
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.message).toBeDefined();
      expect(data.issues).toBeDefined();
      expect(data.issues.body).toHaveLength(1);
    });

    test("should handle validation errors with custom handler", async () => {
      // Arrange
      const customValidationMessage = "Custom validation error handling";
      const app = createTestHono({
        handleValidationErrors: () => {
          return new HttpResponse(
            404,
            {},
            {
              customValidationError: customValidationMessage,
            }
          );
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority to trigger validation error
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.customValidationError).toBe(customValidationMessage);
    });

    test("should handle unknown errors with default handler", async () => {
      // Arrange
      const unknownError = new Error("Something went wrong");
      const app = createTestHono({
        throwTodoError: unknownError,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(500);
      const data = (await response.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should handle unknown errors with custom handler", async () => {
      // Arrange
      const unknownError = new Error("Something went wrong");
      const customUnknownMessage = "Custom unknown error handling";

      const app = createTestHono({
        throwTodoError: unknownError,
        handleUnknownErrors: () => {
          return new HttpResponse(
            500,
            {},
            {
              customUnknownError: customUnknownMessage,
            }
          );
        },
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(500);
      const data = (await response.json()) as any;
      expect(data.customUnknownError).toBe(customUnknownMessage);
    });

    test("should handle validation error handler failures with unknown handlers", async () => {
      // Arrange
      const app = createTestHono({
        handleValidationErrors: () => {
          throw new Error("Validation handler failed"); // Custom handler throws exception
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority to trigger validation error
        },
      });

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert
      expect(response.status).toBe(500);
      const data = (await response.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should handle HTTP response error handler failures with unknown handlers", async () => {
      // Arrange
      const originalError = new HttpResponse(
        404,
        {},
        { code: "TODO_NOT_FOUND", message: "Todo not found" }
      );

      const app = createTestHono({
        throwTodoError: originalError,
        handleHttpResponseErrors: () => {
          throw new Error("HTTP handler failed"); // Custom handler throws exception
        },
        // Fallback to default unknown error handler
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.request(
        "http://localhost/todos",
        prepareRequestData(requestData)
      );

      // Assert - Should fall back to default unknown error handler
      expect(response.status).toBe(500);

      const data = (await response.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
