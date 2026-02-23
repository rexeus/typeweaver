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
  NetworkError,
  PathParameterError,
  ResponseParseError,
  TodoClient,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { createRawMockFetch } from "../helpers";

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

function createPassthroughClient(mockFetch: typeof globalThis.fetch) {
  return new TodoClient({
    fetchFn: mockFetch,
    baseUrl: "http://localhost:3000",
    unknownResponseHandling: "passthrough",
    isSuccessStatusCode: () => true,
  });
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
  test.each([
    ["ECONNREFUSED", "Connection refused"],
    ["ECONNRESET", "Connection reset by peer"],
    ["ENOTFOUND", "DNS lookup failed"],
    ["ETIMEDOUT", "Connection timed out"],
  ] as const)("maps %s to '%s'", async (code, expectedMessage) => {
    const mockFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code },
      }),
    );
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
    });
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === code &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc" &&
          error.message.includes(expectedMessage)
        );
      },
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

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "UNKNOWN" &&
          error.message.includes("fetch failed")
        );
      },
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

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "UNKNOWN" &&
          error.message.includes("something broke")
        );
      },
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

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError && error.cause === originalError
        );
      },
    );
  });
});

describe("ApiClient Response Body Parsing", () => {
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

  test("304 with content-type application/json returns undefined body", async () => {
    const mockFetch = createRawMockFetch(304, null, {
      "content-type": "application/json",
    });
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

  test("invalid JSON with application/json header throws ResponseParseError", async () => {
    const mockFetch = createRawMockFetch(200, "not{json", {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 200 &&
          error.bodyPreview === "not{json" &&
          error.message === "Failed to parse JSON response"
        );
      },
    );
  });

  test("JSON parse failure includes body preview truncated to 200 chars", async () => {
    const longBody = "x".repeat(300);
    const mockFetch = createRawMockFetch(200, longBody, {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.bodyPreview === "x".repeat(200) &&
          error.bodyPreview.length === 200
        );
      },
    );
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

  test("application/problem+json is parsed as JSON", async () => {
    const mockFetch = createRawMockFetch(400, '{"type":"about:blank","title":"Bad Request"}', {
      "content-type": "application/problem+json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toEqual({ type: "about:blank", title: "Bad Request" });
  });

  test("application/vnd.api+json is parsed as JSON", async () => {
    const mockFetch = createRawMockFetch(200, '{"data":{"id":"1"}}', {
      "content-type": "application/vnd.api+json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toEqual({ data: { id: "1" } });
  });

  test("application/problem+json with charset is parsed as JSON", async () => {
    const mockFetch = createRawMockFetch(400, '{"type":"about:blank"}', {
      "content-type": "application/problem+json; charset=utf-8",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toEqual({ type: "about:blank" });
  });

  test("invalid JSON with +json content type throws ResponseParseError", async () => {
    const mockFetch = createRawMockFetch(400, "not{json", {
      "content-type": "application/problem+json",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 400 &&
          error.message === "Failed to parse JSON response"
        );
      },
    );
  });

  test("application/octet-stream returns ArrayBuffer", async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockFetch = createRawMockFetch(200, binaryData, {
      "content-type": "application/octet-stream",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeInstanceOf(ArrayBuffer);
  });

  test("image/png returns ArrayBuffer", async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const mockFetch = createRawMockFetch(200, binaryData, {
      "content-type": "image/png",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeInstanceOf(ArrayBuffer);
  });

  test("application/pdf returns ArrayBuffer", async () => {
    const binaryData = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const mockFetch = createRawMockFetch(200, binaryData, {
      "content-type": "application/pdf",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeInstanceOf(ArrayBuffer);
  });

  test("audio/mpeg returns ArrayBuffer", async () => {
    const binaryData = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    const mockFetch = createRawMockFetch(200, binaryData, {
      "content-type": "audio/mpeg",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeInstanceOf(ArrayBuffer);
  });

  test("text/html returns string", async () => {
    const mockFetch = createRawMockFetch(200, "<h1>Hello</h1>", {
      "content-type": "text/html",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(typeof result.body).toBe("string");
    expect(result.body).toBe("<h1>Hello</h1>");
  });

  test("text/xml returns string", async () => {
    const mockFetch = createRawMockFetch(200, "<root/>", {
      "content-type": "text/xml",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(typeof result.body).toBe("string");
    expect(result.body).toBe("<root/>");
  });

  test("binary response with empty body returns empty ArrayBuffer", async () => {
    const mockFetch = createRawMockFetch(200, new Uint8Array(0), {
      "content-type": "application/octet-stream",
    });
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.body).toBeInstanceOf(ArrayBuffer);
    expect((result.body as ArrayBuffer).byteLength).toBe(0);
  });
});

describe("ApiClient Response Header Handling", () => {
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

  test("preserves multiple Set-Cookie headers as array", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "a=1; Path=/");
    headers.append("set-cookie", "b=2; Path=/");
    headers.append("content-type", "application/json");

    const mockFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('{}', { status: 200, headers }),
    );
    const client = createPassthroughClient(mockFetch);
    const command = new GetTodoRequestCommand(
      createGetTodoRequest({ param: { todoId: "abc" } }),
    );

    const result = await client.send(command);

    expect(result.header["set-cookie"]).toEqual([
      "a=1; Path=/",
      "b=2; Path=/",
    ]);
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

  test("string body is sent as-is without extra quotes", async () => {
    const mockFetch = createRawMockFetch(200, "ok", {
      "content-type": "text/plain",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = "hello";
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe("hello");
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

  test("null body is not sent as the string 'null'", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = new TodoClient({
      fetchFn: mockFetch,
      baseUrl: "http://localhost:3000",
      unknownResponseHandling: "passthrough",
      isSuccessStatusCode: () => true,
    });
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = null;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBeUndefined();
  });

  test("string headers are passed unchanged", async () => {
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
            reject(new DOMException("The operation timed out", "TimeoutError"));
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

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "TIMEOUT" &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc"
        );
      },
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

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "ABORT" &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc"
        );
      },
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

describe("ApiClient Native Body Passthrough", () => {
  test("Blob body is passed to fetch as-is", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const blob = new Blob(["hello"], { type: "text/plain" });
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = blob;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(blob);
  });

  test("ArrayBuffer body is passed to fetch as-is", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const buffer = new ArrayBuffer(8);
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = buffer;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(buffer);
  });

  test("FormData body is passed to fetch as-is", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const formData = new FormData();
    formData.append("file", new Blob(["data"]), "test.txt");
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = formData;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(formData);
  });

  test("URLSearchParams body is passed to fetch as-is", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const params = new URLSearchParams({ key: "value" });
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = params;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(params);
  });

  test("Uint8Array body is passed to fetch as-is", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const bytes = new Uint8Array([1, 2, 3]);
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = bytes;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(bytes);
  });

  test("ReadableStream body is passed to fetch as-is", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    const requestData = createCreateTodoRequest({ body: {} });
    (requestData as { body: unknown }).body = stream;
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(stream);
  });

  test("plain object body still gets JSON.stringify'd", async () => {
    const mockFetch = createRawMockFetch(200, '{}', {
      "content-type": "application/json",
    });
    const client = createPassthroughClient(mockFetch);
    const requestData = createCreateTodoRequest();
    const command = new CreateTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.body).toBe(JSON.stringify(requestData.body));
  });
});

describe("ApiClient Request Header Flattening", () => {
  test("array header values are joined with comma separator", async () => {
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
    (requestData as { header: Record<string, string | string[]> }).header = {
      Accept: "application/json",
      "X-Multi-Value": ["first", "second"],
    };
    const command = new GetTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers["X-Multi-Value"]).toBe("first, second");
    expect(headers["Accept"]).toBe("application/json");
  });

  test("single string headers pass through unchanged", async () => {
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
    const headers = callArgs.headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });

  test("undefined header is passed as undefined", async () => {
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
    (requestData as { header: undefined }).header = undefined;
    const command = new GetTodoRequestCommand(requestData);

    await client.send(command);

    const callArgs = vi.mocked(mockFetch).mock.calls[0][1]!;
    expect(callArgs.headers).toBeUndefined();
  });
});

describe("ApiClient Path Parameter Validation", () => {
  test("throws PathParameterError when key not found in template", async () => {
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
    (requestData as { param: Record<string, string> }).param = {
      todoId: "abc",
      nonExistent: "value",
    };
    const command = new GetTodoRequestCommand(requestData);

    await expect(client.send(command)).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof PathParameterError &&
          error.paramName === "nonExistent" &&
          error.path === "/todos/:todoId" &&
          error.message.includes("Path parameter 'nonExistent' is not found in path")
        );
      },
    );
  });
});

describe("NetworkError", () => {
  test("is instanceof Error", () => {
    const error = new NetworkError("test", "TIMEOUT", "GET", "/api");
    expect(error).toBeInstanceOf(Error);
  });

  test("has name 'NetworkError'", () => {
    const error = new NetworkError("test", "TIMEOUT", "GET", "/api");
    expect(error.name).toBe("NetworkError");
  });

  test("exposes code, method, url", () => {
    const error = new NetworkError(
      "Connection refused",
      "ECONNREFUSED",
      "POST",
      "http://localhost:3000/api",
    );

    expect(error.code).toBe("ECONNREFUSED");
    expect(error.method).toBe("POST");
    expect(error.url).toBe("http://localhost:3000/api");
    expect(error.message).toBe("Connection refused");
  });

  test("preserves cause", () => {
    const cause = new TypeError("fetch failed");
    const error = new NetworkError("test", "UNKNOWN", "GET", "/api", {
      cause,
    });

    expect(error.cause).toBe(cause);
  });
});

describe("PathParameterError", () => {
  test("is instanceof Error", () => {
    const error = new PathParameterError("test", "id", "/users/:id");
    expect(error).toBeInstanceOf(Error);
  });

  test("has name 'PathParameterError'", () => {
    const error = new PathParameterError("test", "id", "/users/:id");
    expect(error.name).toBe("PathParameterError");
  });

  test("exposes paramName and path", () => {
    const error = new PathParameterError(
      "Path parameter 'slug' is not found in path '/posts/:id'",
      "slug",
      "/posts/:id",
    );

    expect(error.paramName).toBe("slug");
    expect(error.path).toBe("/posts/:id");
    expect(error.message).toBe(
      "Path parameter 'slug' is not found in path '/posts/:id'",
    );
  });
});

describe("ResponseParseError", () => {
  test("is instanceof Error", () => {
    const error = new ResponseParseError("test", 200, "body");
    expect(error).toBeInstanceOf(Error);
  });

  test("has name 'ResponseParseError'", () => {
    const error = new ResponseParseError("test", 200, "body");
    expect(error.name).toBe("ResponseParseError");
  });

  test("exposes statusCode and bodyPreview", () => {
    const error = new ResponseParseError(
      "Failed to parse",
      502,
      "<html>Bad Gateway</html>",
    );

    expect(error.statusCode).toBe(502);
    expect(error.bodyPreview).toBe("<html>Bad Gateway</html>");
    expect(error.message).toBe("Failed to parse");
  });

  test("preserves cause", () => {
    const cause = new SyntaxError("Unexpected token");
    const error = new ResponseParseError("test", 200, "body", { cause });

    expect(error.cause).toBe(cause);
  });
});
