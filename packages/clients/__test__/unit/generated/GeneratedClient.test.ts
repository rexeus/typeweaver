import { describe, afterEach, test, expect } from "vitest";
import {
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
import { UnknownResponse, HttpResponse } from "@rexeus/typeweaver-core";
import { setupClientTest, runClientCleanup } from "./clientSetup";

describe("Generated Client", () => {
  afterEach(async () => {
    await runClientCleanup();
  });

  describe("HTTP Methods", () => {
    test("should handle GET requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(GetTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle POST requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createCreateTodoRequest();
      const command = new CreateTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(CreateTodoSuccessResponse);
      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(requestData.body.title);
    });

    test("should handle PUT requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createPutTodoRequest();
      const command = new PutTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(PutTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle PATCH requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(UpdateTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle DELETE requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createDeleteTodoRequest();
      const command = new DeleteTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(DeleteTodoSuccessResponse);
      expect(response.statusCode).toBe(204);
    });

    test("should handle HEAD requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createHeadTodoRequest();
      const command = new HeadTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(HeadTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeUndefined();
    });

    test("should handle OPTIONS requests", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createOptionsTodoRequest();
      const command = new OptionsTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(OptionsTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.header.Allow).toBeDefined();
    });
  });

  describe("UpdateTodo Responses", () => {
    test("should handle 200 responses", async () => {
      // Arrange
      const { client } = await setupClientTest();
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(UpdateTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
    });

    test("should handle 404 responses", async () => {
      // Arrange
      const { client } = await setupClientTest({
        throwTodoError: createTodoNotFoundErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(
        TodoNotFoundErrorResponse
      );
    });

    test("should handle TodoNotChangeable error responses", async () => {
      // Arrange
      const { client } = await setupClientTest({
        throwTodoError: createTodoNotChangeableErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(
        TodoNotChangeableErrorResponse
      );
    });

    test("should handle Forbidden error responses", async () => {
      // Arrange
      const { client } = await setupClientTest({
        throwTodoError: createForbiddenErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(
        ForbiddenErrorResponse
      );
    });

    test("should handle InternalServer error responses", async () => {
      // Arrange
      const { client } = await setupClientTest({
        throwTodoError: createInternalServerErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(
        InternalServerErrorResponse
      );
    });
  });

  describe("Unknown Response Handling", () => {
    test("should throw UnknownResponse by default for unknown response body", async () => {
      // Arrange
      const { client } = await setupClientTest({
        customResponses: new HttpResponse(
          200,
          { "Content-Type": "application/json" },
          { unexpectedField: "unexpected value" }
        ),
      });
      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(UnknownResponse);
    });

    test("should pass through unknown success responses when configured", async () => {
      // Arrange
      const { client } = await setupClientTest(
        {
          customResponses: new HttpResponse(
            200,
            { "Content-Type": "application/json" },
            { unexpectedField: "unexpected value" }
          ),
        },
        { unknownResponseHandling: "passthrough" }
      );

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(UnknownResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ unexpectedField: "unexpected value" });
    });

    test("should still throw for error responses even in passthrough mode", async () => {
      // Arrange
      const { client } = await setupClientTest(
        {
          customResponses: new HttpResponse(
            400,
            { "Content-Type": "application/json" },
            { error: "Bad request with unknown structure" }
          ),
        },
        { unknownResponseHandling: "passthrough" }
      );

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toThrow(UnknownResponse);
    });

    test("should respect custom isSuccessStatusCode predicate", async () => {
      // Arrange
      const { client } = await setupClientTest(
        {
          customResponses: new HttpResponse(
            400,
            { "Content-Type": "application/json" },
            {
              message: "Invalid request",
            }
          ),
        },
        {
          unknownResponseHandling: "passthrough",
          isSuccessStatusCode: statusCode =>
            statusCode >= 200 && statusCode < 401,
        }
      );

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response).toBeInstanceOf(UnknownResponse);
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        message: "Invalid request",
      });
    });
  });
});
