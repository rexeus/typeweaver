import assert from "node:assert";
import { createServer } from "node:http";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  createGetTodoRequest,
  createListTodosSuccessResponse,
  createListTodosRequest,
  createPrefixedTestServer,
  createTestServer,
  createTodoNotFoundErrorResponse,
  GetTodoRequestCommand,
  ListTodosRequestCommand,
  TodoClient,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ServerResponse } from "node:http";
import type { CreateTestServerResult } from "test-utils";

type ClosableServer = {
  close(callback?: (error?: Error) => void): unknown;
};

type RecordedRequest = {
  readonly pathname: string;
  readonly query: Record<string, readonly string[]>;
};

type RecordingServerResult = {
  readonly server: ClosableServer;
  readonly baseUrl: string;
  readonly requests: readonly RecordedRequest[];
};

const servers: ClosableServer[] = [];

function trackServer(result: CreateTestServerResult): CreateTestServerResult {
  servers.push(result.server);
  return result;
}

async function closeServer(server: ClosableServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function queryEntries(searchParams: URLSearchParams) {
  const entries: Record<string, string[]> = {};

  for (const [key, value] of searchParams) {
    entries[key] = [...(entries[key] ?? []), value];
  }

  return entries;
}

function sendJsonResponse(
  serverResponse: ServerResponse,
  response: IHttpResponse
) {
  serverResponse.statusCode = response.statusCode;

  for (const [key, value] of Object.entries(response.header ?? {})) {
    if (value !== undefined) {
      serverResponse.setHeader(key, value);
    }
  }

  serverResponse.end(JSON.stringify(response.body));
}

async function createRecordingListTodosServer(
  prefix: string
): Promise<RecordingServerResult> {
  const requests: RecordedRequest[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    requests.push({
      pathname: url.pathname,
      query: queryEntries(url.searchParams),
    });

    sendJsonResponse(
      response,
      createListTodosSuccessResponse({
        body: { nextToken: "query-through-prefix" },
      })
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected recording server to listen on a TCP port");
  }

  const result = {
    server,
    baseUrl: `http://127.0.0.1:${address.port}${prefix}`,
    requests,
  } satisfies RecordingServerResult;

  servers.push(server);
  return result;
}

afterEach(async () => {
  const activeServers = servers.splice(0);
  await Promise.all(activeServers.map(closeServer));
});

describe("Base URL Routing", () => {
  describe("baseUrl with path prefix", () => {
    test.each([
      {
        scenario: "/api",
        mountPrefix: "/api",
        baseUrl: (value: string) => value,
        todoId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      },
      {
        scenario: "/api/",
        mountPrefix: "/api",
        baseUrl: (value: string) => `${value}/`,
        todoId: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
      },
      {
        scenario: "/api/v1",
        mountPrefix: "/api/v1",
        baseUrl: (value: string) => value,
        todoId: "01BX5ZZKBKACTAV9WEVGEMMVS0",
      },
    ])(
      "routes GET-by-id through $scenario base URL prefix",
      async ({ mountPrefix, baseUrl, todoId }) => {
        const server = trackServer(await createPrefixedTestServer(mountPrefix));
        const client = new TodoClient({ baseUrl: baseUrl(server.baseUrl) });

        const requestData = createGetTodoRequest({
          param: { todoId },
        });
        const command = new GetTodoRequestCommand(requestData);

        const response = await client.send(command);

        expect(response.type).toBe("GetTodoSuccess");
        assert(response.type === "GetTodoSuccess");
        expect(response.statusCode).toBe(200);
        expect(response.body.id).toBe(requestData.param.todoId);
      }
    );
  });

  describe("shared fetch function", () => {
    test("routes two clients with one injected fetch through their own base URLs", async () => {
      const serverA = trackServer(await createTestServer());
      const serverB = trackServer(await createPrefixedTestServer("/api"));
      const sharedFetch = vi.fn<typeof globalThis.fetch>((input, init) =>
        globalThis.fetch(input, init)
      );

      const clientA = new TodoClient({
        baseUrl: serverA.baseUrl,
        fetchFn: sharedFetch,
      });
      const clientB = new TodoClient({
        baseUrl: serverB.baseUrl,
        fetchFn: sharedFetch,
      });

      const requestA = createGetTodoRequest({
        param: { todoId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" },
      });
      const responseA = await clientA.send(new GetTodoRequestCommand(requestA));

      const requestB = createGetTodoRequest({
        param: { todoId: "01BX5ZZKBKACTAV9WEVGEMMVRZ" },
      });
      const responseB = await clientB.send(new GetTodoRequestCommand(requestB));

      expect(responseA.type).toBe("GetTodoSuccess");
      expect(responseB.type).toBe("GetTodoSuccess");
      assert(
        responseA.type === "GetTodoSuccess" &&
          responseB.type === "GetTodoSuccess"
      );
      expect(responseA.body.id).toBe(requestA.param.todoId);
      expect(responseB.body.id).toBe(requestB.param.todoId);
      expect(responseA.body.id).not.toBe(responseB.body.id);
      expect(sharedFetch).toHaveBeenCalledTimes(2);
      expect(sharedFetch.mock.calls.map(([url]) => url)).toEqual([
        `${serverA.baseUrl}/todos/01ARZ3NDEKTSV4RRFFQ69G5FAV`,
        `${serverB.baseUrl}/todos/01BX5ZZKBKACTAV9WEVGEMMVRZ`,
      ]);
    });
  });

  describe("query parameters through HTTP", () => {
    test("sends scalar and repeated query parameters through a base URL prefix", async () => {
      const server = await createRecordingListTodosServer("/api");
      const client = new TodoClient({ baseUrl: server.baseUrl });

      const requestData = {
        ...createListTodosRequest(),
        query: {
          status: "DONE" as const,
          tags: ["urgent", "backend"],
        },
      };
      const command = new ListTodosRequestCommand(requestData);

      const response = await client.send(command);

      expect(response.type).toBe("ListTodosSuccess");
      expect(response.statusCode).toBe(200);
      expect(server.requests).toEqual([
        {
          pathname: "/api/todos",
          query: {
            status: ["DONE"],
            tags: ["urgent", "backend"],
          },
        },
      ]);
    });
  });

  describe("error responses through prefix", () => {
    test("returns generated error union variants through a base URL prefix", async () => {
      const expectedResponse = createTodoNotFoundErrorResponse({
        body: { actualValues: { todoId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
      });
      const { baseUrl } = trackServer(
        await createPrefixedTestServer("/api", {
          throwTodoError: expectedResponse,
        })
      );
      const client = new TodoClient({ baseUrl });

      const requestData = createGetTodoRequest({
        param: { todoId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" },
      });
      const command = new GetTodoRequestCommand(requestData);

      const result = await client.send(command);

      expect(result).toEqual(expectedResponse);
    });
  });
});
