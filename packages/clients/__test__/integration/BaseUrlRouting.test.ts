import axios from "axios";
import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createGetTodoRequest,
  createListTodosRequest,
  createPrefixedTestServer,
  createTestServer,
  createTodoNotFoundErrorResponse,
  CreateTodoRequestCommand,
  CreateTodoSuccessResponse,
  DeleteTodoRequestCommand,
  DeleteTodoSuccessResponse,
  GetTodoRequestCommand,
  GetTodoSuccessResponse,
  ListTodosRequestCommand,
  ListTodosSuccessResponse,
  TodoClient,
  TodoNotFoundErrorResponse,
} from "test-utils";
import { afterEach, describe, expect, test } from "vitest";
import type { ServerType } from "@hono/node-server";
import type { CreateTestServerResult } from "test-utils";

const servers: ServerType[] = [];

function trackServer(result: CreateTestServerResult): CreateTestServerResult {
  servers.push(result.server);
  return result;
}

afterEach(() => {
  for (const server of servers) {
    server.close();
  }
  servers.length = 0;
});

describe("Base URL Routing", () => {
  describe("baseUrl with path prefix", () => {
    test("GET with path parameter through prefix", async () => {
      const { baseUrl } = trackServer(await createPrefixedTestServer("/api"));
      const client = new TodoClient({ baseUrl });

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response).toBeInstanceOf(GetTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("POST to collection route through prefix", async () => {
      const { baseUrl } = trackServer(await createPrefixedTestServer("/api"));
      const client = new TodoClient({ baseUrl });

      const requestData = createCreateTodoRequest();
      const command = new CreateTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response).toBeInstanceOf(CreateTodoSuccessResponse);
      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe(requestData.body.title);
    });

    test("DELETE through prefix", async () => {
      const { baseUrl } = trackServer(await createPrefixedTestServer("/api"));
      const client = new TodoClient({ baseUrl });

      const requestData = createDeleteTodoRequest();
      const command = new DeleteTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response).toBeInstanceOf(DeleteTodoSuccessResponse);
      expect(response.statusCode).toBe(204);
    });

    test("deeply nested prefix", async () => {
      const { baseUrl } = trackServer(
        await createPrefixedTestServer("/api/v1")
      );
      const client = new TodoClient({ baseUrl });

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response).toBeInstanceOf(GetTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(requestData.param.todoId);
    });

    test("trailing slash in baseUrl is handled correctly", async () => {
      const { baseUrl } = trackServer(await createPrefixedTestServer("/api"));
      const client = new TodoClient({ baseUrl: `${baseUrl}/` });

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      const response = await client.send(command);

      expect(response).toBeInstanceOf(GetTodoSuccessResponse);
      expect(response.statusCode).toBe(200);
    });
  });

  describe("shared Axios instance", () => {
    test("two clients with shared instance and same baseUrl", async () => {
      const { baseUrl } = trackServer(await createTestServer());
      const sharedInstance = axios.create();

      const clientA = new TodoClient({
        axiosInstance: sharedInstance,
        baseUrl,
      });
      const clientB = new TodoClient({
        axiosInstance: sharedInstance,
        baseUrl,
      });

      const requestA = createGetTodoRequest();
      const responseA = await clientA.send(new GetTodoRequestCommand(requestA));

      const requestB = createGetTodoRequest();
      const responseB = await clientB.send(new GetTodoRequestCommand(requestB));

      expect(responseA).toBeInstanceOf(GetTodoSuccessResponse);
      expect(responseB).toBeInstanceOf(GetTodoSuccessResponse);
      expect(responseA.body.id).toBe(requestA.param.todoId);
      expect(responseB.body.id).toBe(requestB.param.todoId);
    });

    test("two clients with shared instance and different baseUrls", async () => {
      const serverA = trackServer(await createTestServer());
      const serverB = trackServer(await createPrefixedTestServer("/api"));
      const sharedInstance = axios.create();

      const clientA = new TodoClient({
        axiosInstance: sharedInstance,
        baseUrl: serverA.baseUrl,
      });
      const clientB = new TodoClient({
        axiosInstance: sharedInstance,
        baseUrl: serverB.baseUrl,
      });

      const requestA = createGetTodoRequest();
      const responseA = await clientA.send(new GetTodoRequestCommand(requestA));

      const requestB = createGetTodoRequest();
      const responseB = await clientB.send(new GetTodoRequestCommand(requestB));

      expect(responseA).toBeInstanceOf(GetTodoSuccessResponse);
      expect(responseB).toBeInstanceOf(GetTodoSuccessResponse);
      expect(responseA.body.id).toBe(requestA.param.todoId);
      expect(responseB.body.id).toBe(requestB.param.todoId);
    });
  });

  describe("query parameters through HTTP", () => {
    test("query parameters arrive at server through prefix", async () => {
      const { baseUrl } = trackServer(await createPrefixedTestServer("/api"));
      const client = new TodoClient({ baseUrl });

      const requestData = createListTodosRequest({
        query: { status: "DONE" },
      });
      const command = new ListTodosRequestCommand(requestData);

      const response = await client.send(command);

      expect(response).toBeInstanceOf(ListTodosSuccessResponse);
      expect(response.statusCode).toBe(200);
    });
  });

  describe("error responses through prefix", () => {
    test("error response propagates correctly through prefix", async () => {
      const { baseUrl } = trackServer(
        await createPrefixedTestServer("/api", {
          throwTodoError: createTodoNotFoundErrorResponse(),
        })
      );
      const client = new TodoClient({ baseUrl });

      const requestData = createGetTodoRequest();
      const command = new GetTodoRequestCommand(requestData);

      await expect(client.send(command)).rejects.toThrow(
        TodoNotFoundErrorResponse
      );
    });
  });
});
