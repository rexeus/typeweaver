import {
  createGetTodoRequest,
  createListTodosRequest,
  GetTodoRequestCommand,
  ListTodosRequestCommand,
  TodoClient,
} from "test-utils";
import { describe, expect, test, vi } from "vitest";

function createClientWithBaseUrl(baseUrl: string) {
  const client = new TodoClient({ baseUrl });

  vi.spyOn(client.axiosInstance, "request").mockResolvedValue({
    status: 200,
    headers: { "content-type": "application/json" },
    data: { id: "test", title: "Test", completed: false },
  });

  return client;
}

describe("ApiClient URL Construction", () => {
  function createCommand(todoId: string) {
    const requestData = createGetTodoRequest({ param: { todoId } });
    return new GetTodoRequestCommand(requestData);
  }

  test("base URL without path preserves origin", async () => {
    const client = createClientWithBaseUrl("http://localhost:3000");
    const command = createCommand("abc123");

    await expect(client.send(command)).rejects.toThrow();

    expect(client.axiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost:3000/todos/abc123",
      }),
    );
  });

  test("base URL with path segment preserves the path", async () => {
    const client = createClientWithBaseUrl("http://localhost/api");
    const command = createCommand("abc123");

    await expect(client.send(command)).rejects.toThrow();

    expect(client.axiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost/api/todos/abc123",
      }),
    );
  });

  test("base URL with trailing slash preserves the path", async () => {
    const client = createClientWithBaseUrl("http://localhost/api/");
    const command = createCommand("abc123");

    await expect(client.send(command)).rejects.toThrow();

    expect(client.axiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost/api/todos/abc123",
      }),
    );
  });

  test("nested base path is fully preserved", async () => {
    const client = createClientWithBaseUrl("http://localhost/api/v1");
    const command = createCommand("abc123");

    await expect(client.send(command)).rejects.toThrow();

    expect(client.axiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://localhost/api/v1/todos/abc123",
      }),
    );
  });
});

describe("ApiClient Query String Construction", () => {
  test("single query value appends to URL", async () => {
    const client = createClientWithBaseUrl("http://localhost:3000");
    const request = createListTodosRequest({ query: { status: "TODO" } });
    const command = new ListTodosRequestCommand(request);

    await expect(client.send(command)).rejects.toThrow();

    const calledUrl = vi.mocked(client.axiosInstance.request).mock.calls[0][0]
      .url as string;
    expect(calledUrl).toContain("?");
    expect(calledUrl).toContain("status=TODO");
  });

  test("array query values repeat the key", async () => {
    const client = createClientWithBaseUrl("http://localhost:3000");
    const request = createListTodosRequest({ query: { tags: ["a", "b"] } });
    const command = new ListTodosRequestCommand(request);

    await expect(client.send(command)).rejects.toThrow();

    const calledUrl = vi.mocked(client.axiosInstance.request).mock.calls[0][0]
      .url as string;
    expect(calledUrl).toContain("tags=a");
    expect(calledUrl).toContain("tags=b");
  });

  test("undefined query values are skipped", async () => {
    const client = createClientWithBaseUrl("http://localhost:3000");
    const request = createListTodosRequest({ query: { status: "TODO" } });
    const command = new ListTodosRequestCommand({
      header: request.header,
      query: { status: "TODO", priority: undefined },
    });

    await expect(client.send(command)).rejects.toThrow();

    const calledUrl = vi.mocked(client.axiosInstance.request).mock.calls[0][0]
      .url as string;
    expect(calledUrl).toContain("status=TODO");
    expect(calledUrl).not.toContain("priority");
  });

  test("query combined with base URL path produces correct URL", async () => {
    const client = createClientWithBaseUrl("http://localhost/api");
    const request = createListTodosRequest({ query: { status: "DONE" } });
    const command = new ListTodosRequestCommand(request);

    await expect(client.send(command)).rejects.toThrow();

    const calledUrl = vi.mocked(client.axiosInstance.request).mock.calls[0][0]
      .url as string;
    expect(calledUrl).toMatch(/^http:\/\/localhost\/api\/todos\?/);
    expect(calledUrl).toContain("status=DONE");
  });

  test("no query produces URL without question mark", async () => {
    const client = createClientWithBaseUrl("http://localhost:3000");
    const request = createGetTodoRequest({ param: { todoId: "abc" } });
    const command = new GetTodoRequestCommand(request);

    await expect(client.send(command)).rejects.toThrow();

    const calledUrl = vi.mocked(client.axiosInstance.request).mock.calls[0][0]
      .url as string;
    expect(calledUrl).toBe("http://localhost:3000/todos/abc");
    expect(calledUrl).not.toContain("?");
  });
});

describe("ApiClient Constructor Validation", () => {
  test("throws on empty base URL", () => {
    expect(() => new TodoClient({ baseUrl: "" })).toThrow(
      "Base URL must be provided either in axios instance or in constructor",
    );
  });

  test("accepts valid HTTP URL", () => {
    expect(
      () => new TodoClient({ baseUrl: "http://localhost:3000" }),
    ).not.toThrow();
  });

  test("accepts relative base path", () => {
    expect(() => new TodoClient({ baseUrl: "/api" })).not.toThrow();
  });
});
