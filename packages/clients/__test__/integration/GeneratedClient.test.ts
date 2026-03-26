import { isTaggedHttpResponse } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createForbiddenErrorResponse,
  createGetTodoRequest,
  createHeadTodoRequest,
  createInternalServerErrorResponse,
  createOptionsTodoRequest,
  createPutTodoRequest,
  createTodoNotChangeableErrorResponse,
  createTodoNotFoundErrorResponse,
  CreateTodoRequestCommand,
  createUpdateTodoRequest,
  DeleteTodoRequestCommand,
  GetTodoRequestCommand,
  HeadTodoRequestCommand,
  OptionsTodoRequestCommand,
  PutTodoRequestCommand,
  UpdateTodoRequestCommand,
} from "test-utils";
import { afterEach, describe, expect, test } from "vitest";
import { runClientCleanup, setupClientTest } from "./clientSetup";

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
      expect(response._tag).toBe("GetTodoSuccess");
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
      expect(response._tag).toBe("CreateTodoSuccess");
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
      expect(response._tag).toBe("PutTodoSuccess");
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
      expect(response._tag).toBe("UpdateTodoSuccess");
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
      expect(response._tag).toBe("DeleteTodoSuccess");
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
      expect(response._tag).toBe("HeadTodoSuccess");
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
      expect(response._tag).toBe("OptionsTodoSuccess");
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
      expect(response._tag).toBe("UpdateTodoSuccess");
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
      await expect(client.send(command)).rejects.toSatisfy(
        (error: unknown) =>
          isTaggedHttpResponse(error) && error._tag === "TodoNotFoundError"
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
      await expect(client.send(command)).rejects.toSatisfy(
        (error: unknown) =>
          isTaggedHttpResponse(error) && error._tag === "TodoNotChangeableError"
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
      await expect(client.send(command)).rejects.toSatisfy(
        (error: unknown) =>
          isTaggedHttpResponse(error) && error._tag === "ForbiddenError"
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
      await expect(client.send(command)).rejects.toSatisfy(
        (error: unknown) =>
          isTaggedHttpResponse(error) && error._tag === "InternalServerError"
      );
    });
  });

  describe("Unknown Response Handling", () => {
    test("should throw UnknownResponse by default for unknown response body", async () => {
      // Arrange
      const { client } = await setupClientTest({
        customResponses: {
          statusCode: 200,
          header: { "Content-Type": "application/json" },
          body: { unexpectedField: "unexpected value" },
        } satisfies IHttpResponse,
      });
      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toSatisfy(
        (error: unknown) =>
          isTaggedHttpResponse(error) && error._tag === "Unknown"
      );
    });

    test("should pass through unknown success responses when configured", async () => {
      // Arrange
      const { client } = await setupClientTest(
        {
          customResponses: {
            statusCode: 200,
            header: { "Content-Type": "application/json" },
            body: { unexpectedField: "unexpected value" },
          } satisfies IHttpResponse,
        },
        { unknownResponseHandling: "passthrough" }
      );

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act
      const response = await client.send(command);

      // Assert
      expect(response._tag).toBe("Unknown");
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ unexpectedField: "unexpected value" });
    });

    test("should still throw for error responses even in passthrough mode", async () => {
      // Arrange
      const { client } = await setupClientTest(
        {
          customResponses: {
            statusCode: 400,
            header: { "Content-Type": "application/json" },
            body: { error: "Bad request with unknown structure" },
          } satisfies IHttpResponse,
        },
        { unknownResponseHandling: "passthrough" }
      );

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      // Act & Assert
      await expect(client.send(command)).rejects.toSatisfy(
        (error: unknown) =>
          isTaggedHttpResponse(error) && error._tag === "Unknown"
      );
    });

    test("should respect custom isSuccessStatusCode predicate", async () => {
      // Arrange
      const { client } = await setupClientTest(
        {
          customResponses: {
            statusCode: 400,
            header: { "Content-Type": "application/json" },
            body: {
              message: "Invalid request",
            },
          } satisfies IHttpResponse,
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
      expect(response._tag).toBe("Unknown");
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        message: "Invalid request",
      });
    });
  });
});
