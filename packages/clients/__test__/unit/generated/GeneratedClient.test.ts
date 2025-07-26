import { describe, beforeEach, afterEach, test, expect } from "vitest";
import {
  TodoClient,
  createTestServer,
  GetTodoRequestCommand,
  createGetTodoRequest,
} from "test-utils";
import type { ServerType } from "@hono/node-server";

describe("Generated Client", () => {
  let server: ServerType;
  let todoClient: TodoClient;

  beforeEach(async () => {
    const testServer = await createTestServer();
    server = testServer.server;
    todoClient = new TodoClient({ baseUrl: testServer.baseUrl });
  });

  afterEach(() => {
    server.close();
  });

  describe("HTTP Methods", () => {
    test("should handle GET requests", async () => {
      // Arrange
      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param!.todoId);
    });

    //   test("should handle POST requests", () => {
    //     // TODO: Implement POST request test
    //   });

    //   test("should handle PUT requests", () => {
    //     // TODO: Implement PUT request test
    //   });

    //   test("should handle PATCH requests", () => {
    //     // TODO: Implement PATCH request test
    //   });

    //   test("should handle DELETE requests", () => {
    //     // TODO: Implement DELETE request test
    //   });

    //   test("should handle HEAD requests", () => {
    //     // TODO: Implement HEAD request test (operation needs to be added)
    //   });

    //   test("should handle OPTIONS requests", () => {
    //     // TODO: Implement OPTIONS request test (operation needs to be added)
    //   });
    // });

    // describe("Responses", () => {
    //   test("should handle 201 responses", () => {
    //     // TODO: Implement 201 Created response test using CreateTodo
    //   });

    //   test("should handle 401 responses", () => {
    //     // TODO: Implement 401 Unauthorized response test
    //   });

    //   test("should handle 403 responses", () => {
    //     // TODO: Implement 403 Forbidden response test
    //   });

    //   test("should handle 415 responses", () => {
    //     // TODO: Implement 415 Unsupported Media Type response test
    //   });

    //   test("should handle 422 responses", () => {
    //     // TODO: Implement 422 Validation Error response test
    //   });

    //   test("should handle 429 responses", () => {
    //     // TODO: Implement 429 Too Many Requests response test
    //   });

    //   test("should handle 500 responses", () => {
    //     // TODO: Implement 500 Internal Server Error response test
    //   });

    //   test("should handle responses with bodies not matching spec", () => {
    //     // TODO: Implement test for expected status with invalid response body
    //   });

    //   test("should handle responses with headers not matching spec", () => {
    //     // TODO: Implement test for response with unspecified headers
    //   });

    //   test("should handle responses with status codes not matching spec", () => {
    //     // TODO: Implement test for completely unexpected status code (e.g., 418)
    //   });
  });
});
