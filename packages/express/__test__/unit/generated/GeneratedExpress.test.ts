import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createHeadTodoRequest,
  createListTodosRequest,
  createOptionsTodoRequest,
  createTestExpress,
  createUpdateTodoRequest,
  createUpdateTodoStatusRequest,
} from "test-utils";
import { describe, expect, test } from "vitest";
import { makeRequest } from "../testUtils";
import type { IValidationErrorResponseBody } from "test-utils";

describe("Generated Express Router", () => {
  describe("Operation Registration & Handling", () => {
    test("should register and handle GET operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createListTodosRequest();

      // Act
      const response = await makeRequest(
        app,
        "/todos?status=TODO",
        requestData
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    test("should register and handle POST operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toBeDefined();
    });

    test("should register and handle PUT operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createUpdateTodoStatusRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}/status`,
        requestData
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    test("should register and handle DELETE operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createDeleteTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}`,
        requestData
      );

      // Assert
      expect(response.status).toBe(204);
      expect(response.text).toBe(""); // DELETE should have no content
    });

    test("should register and handle PATCH operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createUpdateTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}`,
        requestData
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    test("should register and handle OPTIONS operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createOptionsTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}`,
        requestData
      );

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers["allow"]).toBeDefined();
    });

    test("should register and handle HEAD operations", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createHeadTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}`,
        requestData
      );

      // Assert
      expect(response.status).toBe(200);
      // HEAD requests in supertest have undefined text/body
      expect(response.body).toEqual({});
    });
  });

  describe("Request Validation", () => {
    test("should validate valid requests successfully", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toBeDefined();
    });

    test("should reject invalid request body", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority
        },
      });

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(400);
      const data = response.body as IValidationErrorResponseBody;
      expect(data.issues.body).toHaveLength(1);
    });

    test("should reject invalid request headers", async () => {
      // Arrange
      const app = createTestExpress();
      const baseRequest = createCreateTodoRequest();
      // Override Content-Type header to invalid value
      // We need to send body as string since Content-Type is text/plain
      const requestData = {
        ...baseRequest,
        header: {
          ...baseRequest.header,
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(baseRequest.body), // Stringify for text/plain
      };

      // Act
      const response = await makeRequest(app, "/todos", requestData as any);

      // Assert
      expect(response.status).toBe(400);
      const data = response.body as IValidationErrorResponseBody;
      expect(data.issues.header).toHaveLength(1);
    });

    test("should reject invalid path parameters", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createUpdateTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        "/todos/invalid-uuid-format",
        requestData
      );

      // Assert
      expect(response.status).toBe(400);
      const data = response.body as IValidationErrorResponseBody;
      expect(data.issues.param).toHaveLength(1);
    });

    test("should reject invalid query parameters", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createListTodosRequest();

      // Act
      const response = await makeRequest(
        app,
        "/todos?status=INVALID_STATUS",
        requestData
      );

      // Assert
      expect(response.status).toBe(400);
      const data = response.body as IValidationErrorResponseBody;
      expect(data.issues.query).toHaveLength(1);
    });

    test("should bypass validation when validateRequests is disabled", async () => {
      // Arrange
      const app = createTestExpress({
        validateRequests: false,
      });
      const requestData = createCreateTodoRequest({
        body: {
          title: "", // Empty title is invalid
        },
      });

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toBeDefined();
    });

    test("should use custom validation error handler when provided", async () => {
      // Arrange
      const customValidationMessage = "Custom validation error";
      const app = createTestExpress({
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
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(400);
      const errorData = response.body as any;
      expect(errorData.message).toBe(customValidationMessage);
    });
  });

  describe("Response Handling", () => {
    test("should handle JSON response bodies", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers["content-type"]).toContain("application/json");

      const data = response.body as any;
      expect(data).toBeDefined();
      expect(typeof data).toBe("object");
      expect(data.id).toBeDefined();
      expect(data.title).toBe(requestData.body.title);
    });

    test("should handle string response bodies", async () => {
      // Arrange
      const customStringResponse = "This is a plain text response";
      const app = createTestExpress({
        throwTodoError: new HttpResponse(
          200,
          { "Content-Type": "text/plain" },
          customStringResponse
        ),
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toBe(customStringResponse);
    });

    test.todo("should handle ArrayBuffer response bodies", async () => {
      // TODO: Implement test
    });

    test.todo("should handle Blob response bodies", async () => {
      // TODO: Implement test
    });

    test.todo("should handle FormData response bodies", async () => {
      // TODO: Implement test
    });

    test.todo("should handle URLSearchParams response bodies", async () => {
      // TODO: Implement test
    });

    test.todo("should handle AsyncIterable response bodies", async () => {
      // TODO: Implement test
    });

    test.todo(
      "should handle NodeJS.ArrayBufferView response bodies",
      async () => {
        // TODO: Implement test
      }
    );

    test("should handle empty response bodies", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createDeleteTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}`,
        requestData
      );

      // Assert
      expect(response.status).toBe(204);
      expect(response.text).toBe("");
    });

    test("should handle single-value response headers", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers["content-type"]).toContain("application/json");
    });

    test("should handle multi-value response headers", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createOptionsTodoRequest();

      // Act
      const response = await makeRequest(
        app,
        `/todos/${requestData.param.todoId}`,
        requestData
      );

      // Assert
      expect(response.status).toBe(200);

      const allowHeader = response.headers["allow"];
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
      const app = createTestExpress({
        throwTodoError: errorResponse,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(404);
      const data = response.body as any;
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
      const app = createTestExpress({
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
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(404);
      const data = response.body as any;
      expect(data.customMessage).toBe(customMessage);
    });

    test("should handle validation errors with default handler", async () => {
      // Arrange
      const app = createTestExpress();
      const requestData = createCreateTodoRequest({
        body: {
          priority: "INVALID_PRIORITY" as any, // Invalid priority to trigger validation error
        },
      });

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(400);
      const data = response.body as any;
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.message).toBeDefined();
      expect(data.issues).toBeDefined();
      expect(data.issues.body).toHaveLength(1);
    });

    test("should handle validation errors with custom handler", async () => {
      // Arrange
      const customValidationMessage = "Custom validation error handling";
      const app = createTestExpress({
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
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(404);
      const data = response.body as any;
      expect(data.customValidationError).toBe(customValidationMessage);
    });

    test("should handle unknown errors with default handler", async () => {
      // Arrange
      const unknownError = new Error("Something went wrong");
      const app = createTestExpress({
        throwTodoError: unknownError,
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(500);
      const data = response.body as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should handle unknown errors with custom handler", async () => {
      // Arrange
      const unknownError = new Error("Something went wrong");
      const customUnknownMessage = "Custom unknown error handling";

      const app = createTestExpress({
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
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(500);
      const data = response.body as any;
      expect(data.customUnknownError).toBe(customUnknownMessage);
    });

    test("should handle validation error handler failures with unknown handlers", async () => {
      // Arrange
      const app = createTestExpress({
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
      const response = await makeRequest(app, "/todos", requestData);

      // Assert
      expect(response.status).toBe(500);
      const data = response.body as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });

    test("should handle HTTP response error handler failures with unknown handlers", async () => {
      // Arrange
      const originalError = new HttpResponse(
        404,
        {},
        { code: "TODO_NOT_FOUND", message: "Todo not found" }
      );

      const app = createTestExpress({
        throwTodoError: originalError,
        handleHttpResponseErrors: () => {
          throw new Error("HTTP handler failed"); // Custom handler throws exception
        },
        // Fallback to default unknown error handler
      });
      const requestData = createCreateTodoRequest();

      // Act
      const response = await makeRequest(app, "/todos", requestData);

      // Assert - Should fall back to default unknown error handler
      expect(response.status).toBe(500);

      const data = response.body as any;
      expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
