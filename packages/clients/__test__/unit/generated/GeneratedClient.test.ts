import { describe, beforeEach, afterEach, test, expect } from "vitest";
import {
  TodoClient,
  createTestServer,
  GetTodoRequestCommand,
  createGetTodoRequest,
  CreateTodoRequestCommand,
  createCreateTodoRequest,
  UpdateTodoStatusRequestCommand,
  createUpdateTodoStatusRequest,
  UpdateTodoRequestCommand,
  createUpdateTodoRequest,
  DeleteTodoRequestCommand,
  createDeleteTodoRequest,
  HeadTodoRequestCommand,
  createHeadTodoRequest,
  OptionsTodoRequestCommand,
  createOptionsTodoRequest,
} from "test-utils";
import { HttpResponse } from "@rexeus/typeweaver-core";
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

    test("should handle POST requests", async () => {
      // Arrange
      const requestData = createCreateTodoRequest();
      const command = new CreateTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(requestData.body!.title);
      expect(response.body.status).toBe("TODO");
    });

    test("should handle PUT requests", async () => {
      // Arrange
      const requestData = createUpdateTodoStatusRequest();
      const command = new UpdateTodoStatusRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param!.todoId);
      expect(response.body.status).toBe(requestData.body!.value);
    });

    test("should handle PATCH requests", async () => {
      // Arrange
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param!.todoId);
      expect(response.body.title).toBe(requestData.body!.title);
    });

    test("should handle DELETE requests", async () => {
      // Arrange
      const requestData = createDeleteTodoRequest();
      const command = new DeleteTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response.statusCode).toBe(204);
    });

    // TODO: Implement HEAD and OPTIONS tests after fixing method support
    // test("should handle HEAD requests", async () => {
    //   // Arrange
    //   const requestData = createHeadTodoRequest();
    //   const command = new HeadTodoRequestCommand({
    //     header: requestData.header!,
    //     param: requestData.param!,
    //   });

    //   // Act
    //   const response = await todoClient.send(command);

    //   // Assert
    //   expect(response.statusCode).toBe(200);
    //   expect(response.body).toBeUndefined();
    // });

    // test("should handle OPTIONS requests", async () => {
    //   // Arrange
    //   const requestData = createOptionsTodoRequest();
    //   const command = new OptionsTodoRequestCommand({
    //     header: requestData.header!,
    //     param: requestData.param!,
    //   });

    //   // Act
    //   const response = await todoClient.send(command);

    //   // Assert
    //   expect(response.statusCode).toBe(200);
    //   expect(response.header.Allow).toBeDefined();
    // });
  });

  describe("Responses", () => {
    test("should handle 201 responses", async () => {
      // Arrange - 201 is the normal CreateTodo response
      const requestData = createCreateTodoRequest();
      const command = new CreateTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(requestData.body!.title);
    });

    test("should handle 401 responses", async () => {
      // Arrange - Use error injection to force 401
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          401,
          { "Content-Type": "application/json" },
          { error: { code: "UNAUTHORIZED", message: "Invalid token" } }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createGetTodoRequest();
        const command = new GetTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle 403 responses", async () => {
      // Arrange - Use error injection to force 403
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          403,
          { "Content-Type": "application/json" },
          { error: { code: "FORBIDDEN", message: "Access denied" } }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createGetTodoRequest();
        const command = new GetTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle 415 responses", async () => {
      // Arrange - Use error injection to force 415
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          415,
          { "Content-Type": "application/json" },
          {
            error: {
              code: "UNSUPPORTED_MEDIA_TYPE",
              message: "Content type not supported",
            },
          }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createCreateTodoRequest();
        const command = new CreateTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle 422 responses", async () => {
      // Arrange - Use error injection to force 422
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          422,
          { "Content-Type": "application/json" },
          {
            error: { code: "VALIDATION_ERROR", message: "Invalid data" },
          }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createCreateTodoRequest();
        const command = new CreateTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle 429 responses", async () => {
      // Arrange - Use error injection to force 429
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          429,
          { "Content-Type": "application/json" },
          {
            error: {
              code: "TOO_MANY_REQUESTS",
              message: "Rate limit exceeded",
            },
          }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createGetTodoRequest();
        const command = new GetTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle 500 responses", async () => {
      // Arrange - Use error injection to force 500
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          500,
          { "Content-Type": "application/json" },
          {
            error: { code: "INTERNAL_SERVER_ERROR", message: "Server error" },
          }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createGetTodoRequest();
        const command = new GetTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle responses with bodies not matching spec", async () => {
      // TODO: Implement test for expected status with invalid response body
      // This would require modifying the test server to return malformed responses
    });

    test("should handle responses with headers not matching spec", async () => {
      // TODO: Implement test for response with unspecified headers
      // This would require modifying the test server to return unexpected headers
    });

    test("should handle responses with status codes not matching spec", async () => {
      // Arrange - Use error injection to force completely unexpected status code
      const errorServer = await createTestServer({
        todoError: new HttpResponse(
          418,
          { "Content-Type": "application/json" },
          { error: { code: "IM_A_TEAPOT", message: "I'm a teapot" } }
        ),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createGetTodoRequest();
        const command = new GetTodoRequestCommand(requestData);

        // Act & Assert - Should throw due to unexpected status code
        await expect(errorClient.send(command)).rejects.toThrow();
      } finally {
        errorServer.server.close();
      }
    });
  });
});
