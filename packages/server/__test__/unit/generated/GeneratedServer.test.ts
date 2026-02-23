import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createHeadTodoRequest,
  createListTodosRequest,
  createOptionsTodoRequest,
  createTestApp,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
} from "test-utils";
import { describe, expect, test } from "vitest";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import type { IValidationErrorResponseBody } from "test-utils";

function buildFetchRequest(url: string, requestData: IHttpRequest): Request {
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

  return new Request(url, {
    method: requestData.method,
    headers,
    body,
  });
}

describe("Generated Server Router", () => {
  describe("Operation Registration & Handling", () => {
    test("should register and handle GET operations", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createListTodosRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos?status=TODO", requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle POST operations", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle PUT operations", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createUpdateTodoStatusRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}/status`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle DELETE operations", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createDeleteTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(204);
      const text = await response.text();
      expect(text).toBe("");
    });

    test("should register and handle PATCH operations", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createUpdateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should register and handle OPTIONS operations", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createOptionsTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get("Allow")).toBeDefined();
    });

    test("should handle HEAD operations via GET fallback", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createHeadTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe("");
    });

    test("should return 404 for unknown paths", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const response = await app.fetch(
        new Request("http://localhost/unknown-path", { method: "GET" })
      );

      // Assert
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.code).toBe("NOT_FOUND");
    });

    test("should return 405 for wrong method on valid path", async () => {
      // Arrange
      const app = createTestApp();

      // Act — PATCH is not registered on /todos (only GET and POST)
      const response = await app.fetch(
        new Request("http://localhost/todos", { method: "PATCH" })
      );

      // Assert
      expect(response.status).toBe(405);
      const data = (await response.json()) as any;
      expect(data.code).toBe("METHOD_NOT_ALLOWED");
      expect(response.headers.get("Allow")).toBeDefined();
    });
  });

  describe("Request Validation", () => {
    test("should validate valid requests successfully", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should reject invalid request body", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.body).toHaveLength(1);
    });

    test("should reject invalid request headers", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createCreateTodoRequest({
        header: {
          "Content-Type": "text/plain" as any,
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.header).toHaveLength(1);
    });

    test("should reject invalid path parameters", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createUpdateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          "http://localhost/todos/invalid-uuid-format",
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.param).toHaveLength(1);
    });

    test("should reject invalid query parameters", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createListTodosRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          "http://localhost/todos?status=INVALID_STATUS",
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(400);
      const data = (await response.json()) as IValidationErrorResponseBody;
      expect(data.issues.query).toHaveLength(1);
    });

    test("should bypass validation when validateRequests is disabled", async () => {
      // Arrange
      const app = createTestApp({
        validateRequests: false,
      });
      const requestData = createCreateTodoRequest({
        body: {
          title: "",
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test("should use custom validation error handler when provided", async () => {
      // Arrange
      const customValidationMessage = "Custom validation error";
      const app = createTestApp({
        handleValidationErrors: () => {
          return {
            statusCode: 400,
            header: { "Content-Type": "application/json" },
            body: { message: customValidationMessage },
          };
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
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
      const app = createTestApp();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
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
      const app = createTestApp({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "text/plain" },
          customStringResponse
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(customStringResponse);
    });

    test("should handle empty response bodies", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createDeleteTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(204);
      const text = await response.text();
      expect(text).toBe("");
    });

    test("should handle single-value response headers", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    test("should handle multi-value response headers", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createOptionsTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest(
          `http://localhost/todos/${requestData.param.todoId}`,
          requestData
        )
      );

      // Assert
      expect(response.status).toBe(200);

      const allowHeader = response.headers.get("Allow");
      expect(allowHeader).toBeDefined();
      expect(allowHeader).toBe("GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
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
      const app = createTestApp({
        throwTodoError: errorResponse,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
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
      const app = createTestApp({
        throwTodoError: errorResponse,
        handleHttpResponseErrors: error => {
          return {
            statusCode: 404,
            body: {
              customMessage,
            },
          };
        },
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.customMessage).toBe(customMessage);
    });

    test("should handle validation errors with default handler", async () => {
      // Arrange
      const app = createTestApp();
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
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
      const app = createTestApp({
        handleValidationErrors: () => {
          return {
            statusCode: 404,
            body: {
              customValidationError: customValidationMessage,
            },
          };
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.customValidationError).toBe(customValidationMessage);
    });

    test("should handle unknown errors with default handler", async () => {
      // Arrange
      const unknownError = new Error("Something went wrong");
      const app = createTestApp({
        throwTodoError: unknownError,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
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

      const app = createTestApp({
        throwTodoError: unknownError,
        handleUnknownErrors: () => {
          return {
            statusCode: 500,
            body: {
              customUnknownError: customUnknownMessage,
            },
          };
        },
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(500);
      const data = (await response.json()) as any;
      expect(data.customUnknownError).toBe(customUnknownMessage);
    });

    test("should handle validation error handler failures with unknown handlers", async () => {
      // Arrange
      const app = createTestApp({
        handleValidationErrors: () => {
          throw new Error("Validation handler failed");
        },
      });
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any,
        },
      });

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
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

      const app = createTestApp({
        throwTodoError: originalError,
        handleHttpResponseErrors: () => {
          throw new Error("HTTP handler failed");
        },
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert — Should fall back to default unknown error handler
      expect(response.status).toBe(500);
      const data = (await response.json()) as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("Middleware", () => {
    test("should execute global middleware for all requests", async () => {
      // Arrange
      const app = createTestApp();
      let middlewareExecuted = false;
      app.use(async (_ctx, next) => {
        middlewareExecuted = true;
        return next();
      });
      const requestData = createCreateTodoRequest();

      // Act
      await app.fetch(buildFetchRequest("http://localhost/todos", requestData));

      // Assert
      expect(middlewareExecuted).toBe(true);
    });

    test("should execute middleware even for 404 responses", async () => {
      // Arrange
      const app = createTestApp();
      let middlewareExecuted = false;
      app.use(async (_ctx, next) => {
        middlewareExecuted = true;
        return next();
      });

      // Act
      await app.fetch(
        new Request("http://localhost/unknown-path", { method: "GET" })
      );

      // Assert
      expect(middlewareExecuted).toBe(true);
    });

    test("should allow middleware to short-circuit with custom response", async () => {
      // Arrange
      const app = createTestApp({
        customResponses: {
          statusCode: 418,
          body: { message: "I'm a teapot" },
        },
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await app.fetch(
        buildFetchRequest("http://localhost/todos", requestData)
      );

      // Assert
      expect(response.status).toBe(418);
      const data = (await response.json()) as any;
      expect(data.message).toBe("I'm a teapot");
    });
  });
});
