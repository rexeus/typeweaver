import { describe, beforeEach, afterEach, test, expect } from "vitest";
import {
  TodoClient,
  createTestServer,
  GetTodoRequestCommand,
  createGetTodoRequest,
  CreateTodoRequestCommand,
  createCreateTodoRequest,
  PutTodoRequestCommand,
  createPutTodoRequest,
  UpdateTodoRequestCommand,
  createUpdateTodoRequest,
  DeleteTodoRequestCommand,
  createDeleteTodoRequest,
  HeadTodoRequestCommand,
  createHeadTodoRequest,
  OptionsTodoRequestCommand,
  createOptionsTodoRequest,
  GetTodoSuccessResponse,
  CreateTodoSuccessResponse,
  PutTodoSuccessResponse,
  UpdateTodoSuccessResponse,
  DeleteTodoSuccessResponse,
  HeadTodoSuccessResponse,
  OptionsTodoSuccessResponse,
  ForbiddenErrorResponse,
  createTodoNotFoundErrorResponse,
  createTodoNotChangeableErrorResponse,
  createForbiddenErrorResponse,
  createInternalServerErrorResponse,
  TodoNotFoundErrorResponse,
  TodoNotChangeableErrorResponse,
  InternalServerErrorResponse,
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
      expect(response).toBeInstanceOf(GetTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle POST requests", async () => {
      // Arrange
      const requestData = createCreateTodoRequest();
      const command = new CreateTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(CreateTodoSuccessResponse);
      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(requestData.body.title);
    });

    test("should handle PUT requests", async () => {
      // Arrange
      const requestData = createPutTodoRequest();
      const command = new PutTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(PutTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle PATCH requests", async () => {
      // Arrange
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(UpdateTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle DELETE requests", async () => {
      // Arrange
      const requestData = createDeleteTodoRequest();
      const command = new DeleteTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(DeleteTodoSuccessResponse);
      expect(response.statusCode).toBe(204);
    });

    test("should handle HEAD requests", async () => {
      // Arrange
      const requestData = createHeadTodoRequest();
      const command = new HeadTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(HeadTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeUndefined();
    });

    test("should handle OPTIONS requests", async () => {
      // Arrange
      const requestData = createOptionsTodoRequest();
      const command = new OptionsTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(OptionsTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.header.Allow).toBeDefined();
    });
  });

  describe("UpdateTodo Responses", () => {
    test("should handle 200 responses", async () => {
      // Arrange
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act
      const response = await todoClient.send(command);

      // Assert
      expect(response).toBeInstanceOf(UpdateTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
    });

    test("should handle 404 responses", async () => {
      // Arrange
      const server = await createTestServer({
        todoError: createTodoNotFoundErrorResponse(),
      });
      const errorClient = new TodoClient({ baseUrl: server.baseUrl });

      try {
        const requestData = createUpdateTodoRequest();
        const command = new UpdateTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow(
          TodoNotFoundErrorResponse
        );
      } finally {
        server.server.close();
      }
    });

    test("should handle TodoNotChangeable error responses", async () => {
      // Arrange
      const errorServer = await createTestServer({
        todoError: createTodoNotChangeableErrorResponse(),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createUpdateTodoRequest();
        const command = new UpdateTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow(
          TodoNotChangeableErrorResponse
        );
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle Forbidden error responses", async () => {
      // Arrange
      const errorServer = await createTestServer({
        todoError: createForbiddenErrorResponse(),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createUpdateTodoRequest();
        const command = new UpdateTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow(
          ForbiddenErrorResponse
        );
      } finally {
        errorServer.server.close();
      }
    });

    test("should handle InternalServer error responses", async () => {
      // Arrange
      const errorServer = await createTestServer({
        todoError: createInternalServerErrorResponse(),
      });
      const errorClient = new TodoClient({ baseUrl: errorServer.baseUrl });

      try {
        const requestData = createUpdateTodoRequest();
        const command = new UpdateTodoRequestCommand(requestData);

        // Act & Assert
        await expect(errorClient.send(command)).rejects.toThrow(
          InternalServerErrorResponse
        );
      } finally {
        errorServer.server.close();
      }
    });
  });
});
