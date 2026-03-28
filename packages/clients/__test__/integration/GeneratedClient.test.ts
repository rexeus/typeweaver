import assert from "node:assert";
import { UnknownResponseError } from "@rexeus/typeweaver-core";
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
      const { client } = await setupClientTest();
      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("GetTodoSuccess");
      assert(response.type === "GetTodoSuccess");
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle POST requests", async () => {
      const { client } = await setupClientTest();
      const requestData = createCreateTodoRequest();
      const command = new CreateTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("CreateTodoSuccess");
      assert(response.type === "CreateTodoSuccess");
      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(requestData.body.title);
    });

    test("should handle PUT requests", async () => {
      const { client } = await setupClientTest();
      const requestData = createPutTodoRequest();
      const command = new PutTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("PutTodoSuccess");
      assert(response.type === "PutTodoSuccess");
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle PATCH requests", async () => {
      const { client } = await setupClientTest();
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("UpdateTodoSuccess");
      assert(response.type === "UpdateTodoSuccess");
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("should handle DELETE requests", async () => {
      const { client } = await setupClientTest();
      const requestData = createDeleteTodoRequest();
      const command = new DeleteTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("DeleteTodoSuccess");
      expect(response.statusCode).toBe(204);
    });

    test("should handle HEAD requests", async () => {
      const { client } = await setupClientTest();
      const requestData = createHeadTodoRequest();
      const command = new HeadTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("HeadTodoSuccess");
      expect(response.statusCode).toBe(200);
      expect(response.body).toBeUndefined();
    });

    test("should handle OPTIONS requests", async () => {
      const { client } = await setupClientTest();
      const requestData = createOptionsTodoRequest();
      const command = new OptionsTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("OptionsTodoSuccess");
      assert(response.type === "OptionsTodoSuccess");
      expect(response.statusCode).toBe(200);
      expect(response.header.Allow).toBeDefined();
    });
  });

  describe("UpdateTodo Responses", () => {
    test("should handle 200 responses", async () => {
      const { client } = await setupClientTest();
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("UpdateTodoSuccess");
      expect(response.statusCode).toBe(200);
    });

    test("should handle 404 responses", async () => {
      const { client } = await setupClientTest({
        throwTodoError: createTodoNotFoundErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const result = await client.send(command);

      expect(result.type).toBe("TodoNotFoundError");
    });

    test("should handle TodoNotChangeable error responses", async () => {
      const { client } = await setupClientTest({
        throwTodoError: createTodoNotChangeableErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const result = await client.send(command);

      expect(result.type).toBe("TodoNotChangeableError");
    });

    test("should handle Forbidden error responses", async () => {
      const { client } = await setupClientTest({
        throwTodoError: createForbiddenErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const result = await client.send(command);

      expect(result.type).toBe("ForbiddenError");
    });

    test("should handle InternalServer error responses", async () => {
      const { client } = await setupClientTest({
        throwTodoError: createInternalServerErrorResponse(),
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const result = await client.send(command);

      expect(result.type).toBe("InternalServerError");
    });
  });

  describe("Unknown Response Handling", () => {
    test("should throw UnknownResponseError for unknown response body", async () => {
      const { client } = await setupClientTest({
        customResponses: {
          statusCode: 200,
          header: { "Content-Type": "application/json" },
          body: { unexpectedField: "unexpected value" },
        } satisfies IHttpResponse,
      });
      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      await expect(client.send(command)).rejects.toThrow(UnknownResponseError);
    });

    test("should throw UnknownResponseError for unknown error responses", async () => {
      const { client } = await setupClientTest({
        customResponses: {
          statusCode: 400,
          header: { "Content-Type": "application/json" },
          body: { error: "Bad request with unknown structure" },
        } satisfies IHttpResponse,
      });

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      await expect(client.send(command)).rejects.toThrow(UnknownResponseError);
    });
  });
});
