import {
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createGetTodoRequest,
  createListTodosRequest,
  CreateTodoRequestCommand,
  DeleteTodoRequestCommand,
  DeleteTodoSuccessResponse,
  GetTodoRequestCommand,
  ListTodosRequestCommand,
  TodoClient,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";

function createMockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
): typeof globalThis.fetch {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      body !== undefined ? JSON.stringify(body) : null,
      { status, headers },
    ),
  );
}

function createRawMockFetch(
  status: number,
  body: BodyInit | null,
  headers: Record<string, string> = {},
): typeof globalThis.fetch {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(body, { status, headers }),
  );
}

function createClientWithMockFetch(baseUrl: string) {
  const mockFetch = createMockFetch(200, {
    id: "test",
    title: "Test",
    completed: false,
  });
  const client = new TodoClient({
    baseUrl,
    fetchFn: mockFetch,
    unknownResponseHandling: "passthrough",
    isSuccessStatusCode: () => true,
  });
  return { client, mockFetch };
}

describe("ApiClient URL Construction", () => {
  function createCommand(todoId: string) {
    const requestData = createGetTodoRequest({ param: { todoId } });
    return new GetTodoRequestCommand(requestData);
  }

  test("base URL without path preserves origin", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost:3000",
    );
    const command = createCommand("abc123");

    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("base URL with path segment preserves the path", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost/api",
    );
    const command = createCommand("abc123");

    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("base URL with trailing slash preserves the path", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost/api/",
    );
    const command = createCommand("abc123");

    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("nested base path is fully preserved", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost/api/v1",
    );
    const command = createCommand("abc123");

    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("custom fetchFn is used when provided", async () => {
    const mockFetch = createMockFetch(200, {
      id: "test",
      title: "Test",
      completed: false,
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost/api",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });

    const command = createCommand("abc123");
    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("two clients with same fetchFn do not interfere", async () => {
    const sharedFetch = createMockFetch(200, {
      id: "test",
      title: "Test",
      completed: false,
    });

    const clientA = new TodoClient({
      fetchFn: sharedFetch,
      baseUrl: "http://localhost/api",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const clientB = new TodoClient({
      fetchFn: sharedFetch,
      baseUrl: "http://localhost/api",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });

    expect(clientA.baseUrl).toBe("http://localhost/api");
    expect(clientB.baseUrl).toBe("http://localhost/api");

    const command = createCommand("abc123");
    await clientA.send(command);

    expect(sharedFetch).toHaveBeenCalledWith(
      "http://localhost/api/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("relative base path works without host", async () => {
    const { client, mockFetch } = createClientWithMockFetch("/api");
    const command = createCommand("abc123");

    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/todos/abc123",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("path parameters with special characters are percent-encoded", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost:3000",
    );
    const command = createCommand("hello world");

    await client.send(command);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/todos/hello%20world",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("ApiClient Query String Construction", () => {
  test("single query value appends to URL", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost:3000",
    );
    const request = createListTodosRequest({ query: { status: "TODO" } });
    const command = new ListTodosRequestCommand(request);

    await client.send(command);

    const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("?");
    expect(calledUrl).toContain("status=TODO");
  });

  test("array query values repeat the key", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost:3000",
    );
    const request = createListTodosRequest({ query: { tags: ["a", "b"] } });
    const command = new ListTodosRequestCommand(request);

    await client.send(command);

    const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("tags=a");
    expect(calledUrl).toContain("tags=b");
  });

  test("undefined query values are skipped", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost:3000",
    );
    const request = createListTodosRequest({ query: { status: "TODO" } });
    const command = new ListTodosRequestCommand({
      header: request.header,
      query: { status: "TODO", priority: undefined },
    });

    await client.send(command);

    const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("status=TODO");
    expect(calledUrl).not.toContain("priority");
  });

  test("query combined with base URL path produces correct URL", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost/api",
    );
    const request = createListTodosRequest({ query: { status: "DONE" } });
    const command = new ListTodosRequestCommand(request);

    await client.send(command);

    const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/^http:\/\/localhost\/api\/todos\?/);
    expect(calledUrl).toContain("status=DONE");
  });

  test("no query produces URL without question mark", async () => {
    const { client, mockFetch } = createClientWithMockFetch(
      "http://localhost:3000",
    );
    const request = createGetTodoRequest({ param: { todoId: "abc" } });
    const command = new GetTodoRequestCommand(request);

    await client.send(command);

    const calledUrl = vi.mocked(mockFetch).mock.calls[0][0] as string;
    expect(calledUrl).toBe("http://localhost:3000/todos/abc");
    expect(calledUrl).not.toContain("?");
  });
});

describe("ApiClient Constructor Validation", () => {
  test("throws on empty base URL", () => {
    expect(
      () => new TodoClient({ baseUrl: "" }),
    ).toThrow("Base URL must be provided");
  });

  test("accepts valid HTTP URL", () => {
    expect(
      () => new TodoClient({ baseUrl: "http://localhost:3000" }),
    ).not.toThrow();
  });

  test("accepts relative base path", () => {
    expect(() => new TodoClient({ baseUrl: "/api" })).not.toThrow();
  });

  test("throws on timeoutMs: 0", () => {
    expect(
      () => new TodoClient({ baseUrl: "http://localhost:3000", timeoutMs: 0 }),
    ).toThrow("timeoutMs must be a positive finite number");
  });

  test("throws on timeoutMs: -1", () => {
    expect(
      () => new TodoClient({ baseUrl: "http://localhost:3000", timeoutMs: -1 }),
    ).toThrow("timeoutMs must be a positive finite number");
  });

  test("throws on timeoutMs: NaN", () => {
    expect(
      () =>
        new TodoClient({ baseUrl: "http://localhost:3000", timeoutMs: NaN }),
    ).toThrow("timeoutMs must be a positive finite number");
  });

  test("throws on timeoutMs: Infinity", () => {
    expect(
      () =>
        new TodoClient({
          baseUrl: "http://localhost:3000",
          timeoutMs: Infinity,
        }),
    ).toThrow("timeoutMs must be a positive finite number");
  });

  test("accepts valid timeoutMs", () => {
    expect(
      () =>
        new TodoClient({ baseUrl: "http://localhost:3000", timeoutMs: 5000 }),
    ).not.toThrow();
  });
});

describe("ApiClient Network Error Handling", () => {
  test("maps ECONNREFUSED to connection refused error", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ECONNREFUSED" },
      }),
    );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: Connection refused (GET http://localhost:3000/todos/abc)",
    );
  });

  test("maps ECONNRESET to connection reset error", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ECONNRESET" },
      }),
    );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: Connection reset by peer (GET http://localhost:3000/todos/abc)",
    );
  });

  test("maps ENOTFOUND to DNS lookup failed error", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND" },
      }),
    );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: DNS lookup failed (GET http://localhost:3000/todos/abc)",
    );
  });

  test("maps ETIMEDOUT to connection timed out error", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ETIMEDOUT" },
      }),
    );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: Connection timed out (GET http://localhost:3000/todos/abc)",
    );
  });

  test("maps unknown TypeError to generic network error", async () => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: fetch failed (GET http://localhost:3000/todos/abc)",
    );
  });

  test("maps non-Error throw to string network error", async () => {
    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue("something broke");
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: something broke (GET http://localhost:3000/todos/abc)",
    );
  });

  test("preserves original error as cause", async () => {
    const originalError = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(originalError);
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy((error: Error) => {
      return error.cause === originalError;
    });
  });
});

describe("ApiClient Response Body Parsing", () => {
  function createPassthroughClient(mockFetch: typeof globalThis.fetch) {
    return new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
  }

  test("204 No Content returns undefined body", async () => {
    const mockFetch = createRawMockFetch(204, null, {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new DeleteTodoRequestCommand(createDeleteTodoRequest());

    const result = await client.send(command);

    expect(result).toBeInstanceOf(DeleteTodoSuccessResponse);
    expect(result.body).toBeUndefined();
  });

  test("304 Not Modified returns undefined body", async () => {
    const mockFetch = createRawMockFetch(304, null);
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeUndefined();
  });

  test("empty response text returns undefined body", async () => {
    const mockFetch = createRawMockFetch(200, "");
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeUndefined();
  });

  test("valid JSON with application/json header is parsed", async () => {
    const mockFetch = createRawMockFetch(200, '{"key":"value"}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toEqual({ key: "value" });
  });

  test("invalid JSON with application/json header throws parse error", async () => {
    const mockFetch = createRawMockFetch(200, "not{json", {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Failed to parse JSON response (status 200)",
    );
  });

  test("JSON parse failure includes body preview", async () => {
    const longBody = "x".repeat(300);
    const mockFetch = createRawMockFetch(200, longBody, {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy((error: Error) => {
      return (
        error.message.includes("Body (first 200 chars):") &&
        error.message.includes("x".repeat(200)) &&
        !error.message.includes("x".repeat(201))
      );
    });
  });

  test("text/plain content is returned as string", async () => {
    const mockFetch = createRawMockFetch(200, "plain text", {
      "content-type": "text/plain",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBe("plain text");
  });

  test("no Content-Type header returns raw text", async () => {
    const mockFetch = createRawMockFetch(200, "raw content");
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBe("raw content");
  });

  test("JSON with charset=utf-8 in Content-Type is parsed", async () => {
    const mockFetch = createRawMockFetch(200, '{"a":1}', {
      "content-type": "application/json; charset=utf-8",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toEqual({ a: 1 });
  });
});

describe("ApiClient Response Header Handling", () => {
  function createPassthroughClient(mockFetch: typeof globalThis.fetch) {
    return new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
  }

  test("single header is stored as string", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
      "x-request-id": "abc123",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.header["x-request-id"]).toBe("abc123");
  });

  test("multi-value headers are comma-joined by native Headers", async () => {
    const headers = new Headers();
    headers.append("x-custom", "first");
    headers.append("x-custom", "second");
    headers.append("content-type", "application/json");

    const mockFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers }),
    );
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.header["x-custom"]).toBe("first, second");
  });

  test("multiple distinct headers are preserved", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
      "x-a": "1",
      "x-b": "2",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.header["x-a"]).toBe("1");
    expect(result.header["x-b"]).toBe("2");
  });
});

describe("ApiClient Request Options Passthrough", () => {
  test("POST body is JSON.stringify'd", async () => {
    const mockFetch = createMockFetch(201, { id: "new", title: "Test", completed: false });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const requestData = createCreateTodoRequest();
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(JSON.stringify(requestData.body));
  });

  test("GET has undefined body", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBeUndefined();
  });

  test("headers are passed unchanged", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const requestData = createGetTodoRequest({ param: { todoId: "abc" } });
    const command = new GetTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.headers).toEqual(requestData.header);
  });

  test("HTTP method is passed correctly", async () => {
    const mockFetch = createMockFetch(201, { id: "new", title: "Test", completed: false });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const command = new CreateTodoRequestCommand(createCreateTodoRequest());

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.method).toBe("POST");
  });
});

describe("ApiClient Request Timeout", () => {
  test("request is aborted after timeout", async () => {
    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation((_url, init) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => resolve(new Response("{}", { status: 200 })),
            5000,
          );
          init?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
      );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      timeoutMs: 50,
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: Request timed out (GET http://localhost:3000/todos/abc)",
    );
  });

  test("fast response succeeds within timeout", async () => {
    const mockFetch = createRawMockFetch(204, null, {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      timeoutMs: 5000,
    });
    const command = new DeleteTodoRequestCommand(createDeleteTodoRequest());

    const result = await client.send(command);

    expect(result).toBeInstanceOf(DeleteTodoSuccessResponse);
  });

  test("no signal is passed without timeoutMs", async () => {
    const mockFetch = createRawMockFetch(204, null, {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new DeleteTodoRequestCommand(createDeleteTodoRequest());

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.signal).toBeUndefined();
  });

  test("signal is present when timeoutMs is set", async () => {
    const mockFetch = createRawMockFetch(204, null, {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      timeoutMs: 1000,
    });
    const command = new DeleteTodoRequestCommand(createDeleteTodoRequest());

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.signal).toBeInstanceOf(AbortSignal);
  });

  test("Node.js AbortError without timeout is classified as aborted", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValue(abortError);
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toThrow(
      "Network error: Request aborted (GET http://localhost:3000/todos/abc)",
    );
  });
});

describe("ApiClient Serialization Error Isolation", () => {
  test("circular reference body throws TypeError, not network error", async () => {
    const mockFetch = createMockFetch(200, {});
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const requestData = createCreateTodoRequest();
    // Override body after factory construction to avoid deepmerge hitting circular ref
    (requestData as { body: unknown }).body = circular;
    const command = new CreateTodoRequestCommand(requestData);

    await expect(client.send(command)).rejects.toSatisfy((error: Error) => {
      return error instanceof TypeError && !error.message.startsWith("Network error:");
    });
  });
});

describe("ApiClient Body Read Error Isolation", () => {
  test("body-read error is not misclassified as network error", async () => {
    const mockResponse = new Response("body", { status: 200 });
    vi.spyOn(mockResponse, "text").mockRejectedValue(
      new Error("body stream interrupted"),
    );
    const mockFetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(mockResponse);
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy((error: Error) => {
      return !error.message.startsWith("Network error:");
    });
  });
});
