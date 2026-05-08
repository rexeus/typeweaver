import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  IHttpBody,
  IHttpHeader,
  IHttpParam,
  IHttpQuery,
  IHttpResponse,
} from "@rexeus/typeweaver-core";
import { describe, expect, test, vi } from "vitest";
import { ApiClient } from "../../src/lib/ApiClient.js";
import { NetworkError } from "../../src/lib/NetworkError.js";
import { PathParameterError } from "../../src/lib/PathParameterError.js";
import { RequestCommand } from "../../src/lib/RequestCommand.js";
import { ResponseParseError } from "../../src/lib/ResponseParseError.js";
import type { ApiClientProps } from "../../src/lib/ApiClient.js";
import type { NetworkErrorCode } from "../../src/lib/NetworkError.js";

type TestRequestCommandProps = {
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly header?: IHttpHeader;
  readonly param?: IHttpParam;
  readonly query?: IHttpQuery;
  readonly body?: IHttpBody;
};

class TestApiClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public send(command: RequestCommand): Promise<IHttpResponse> {
    return this.execute(command);
  }
}

class TestRequestCommand extends RequestCommand {
  public override readonly operationId = "TestRequest";
  public override readonly method: HttpMethod;
  public override readonly path: string;
  public override readonly header: IHttpHeader;
  public override readonly param: IHttpParam;
  public override readonly query: IHttpQuery;
  public override readonly body: IHttpBody;

  public constructor(props: TestRequestCommandProps = {}) {
    super();

    this.method = props.method ?? HttpMethod.GET;
    this.path = props.path ?? "/todos";
    this.header = props.header;
    this.param = props.param;
    this.query = props.query;
    this.body = props.body;
  }

  public override processResponse(response: IHttpResponse): IHttpResponse {
    return response;
  }
}

function resolvedFetch(
  response: Response = new Response(null, { status: 204 })
) {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
}

function rejectedFetch(error: unknown) {
  return vi.fn<typeof globalThis.fetch>().mockRejectedValue(error);
}

function createClient(
  mockFetch: typeof globalThis.fetch = resolvedFetch(),
  props: Partial<ApiClientProps> = {}
): TestApiClient {
  return new TestApiClient({
    baseUrl: "http://localhost:3000",
    fetchFn: mockFetch,
    ...props,
  });
}

function getFetchCall(mockFetch: typeof globalThis.fetch): {
  readonly url: string;
  readonly init: RequestInit;
} {
  const call = vi.mocked(mockFetch).mock.calls[0];
  if (!call) {
    throw new Error("Expected fetch to have been called");
  }

  return {
    url: call[0] as string,
    init: call[1] ?? {},
  };
}

async function expectPathParameterRejection(
  promise: Promise<unknown>,
  expected: { readonly paramName: string; readonly path: string }
): Promise<void> {
  await expect(promise).rejects.toSatisfy((error: unknown) => {
    return (
      error instanceof PathParameterError &&
      error.paramName === expected.paramName &&
      error.path === expected.path
    );
  });
}

async function sendRaw(
  commandProps: TestRequestCommandProps,
  clientProps: Partial<ApiClientProps> = {}
): Promise<{
  readonly result: IHttpResponse;
  readonly mockFetch: typeof globalThis.fetch;
}> {
  const mockFetch = resolvedFetch(
    new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
  const client = createClient(mockFetch, clientProps);

  const result = await client.send(new TestRequestCommand(commandProps));

  return { result, mockFetch };
}

describe("ApiClient constructor", () => {
  test.each([
    { case: "HTTP absolute base URL", baseUrl: "http://localhost:3000" },
    { case: "HTTPS absolute base URL", baseUrl: "https://api.example.com" },
    { case: "relative base path", baseUrl: "/api" },
  ])("accepts $case", ({ baseUrl }) => {
    expect(() => createClient(resolvedFetch(), { baseUrl })).not.toThrow();
  });

  test.each([
    { case: "empty", baseUrl: "" },
    { case: "whitespace-only", baseUrl: "   \t\n" },
  ])("rejects $case baseUrl", ({ baseUrl }) => {
    expect(() => createClient(resolvedFetch(), { baseUrl })).toThrow(
      "Base URL must be provided"
    );
  });

  test("rejects a missing baseUrl with the validation error", () => {
    const props = { fetchFn: resolvedFetch() } as unknown as ApiClientProps;

    expect(() => new TestApiClient(props)).toThrow("Base URL must be provided");
  });

  test("rejects a non-string baseUrl with the validation error", () => {
    const props = {
      baseUrl: 123 as unknown as string,
      fetchFn: resolvedFetch(),
    } satisfies ApiClientProps;

    expect(() => new TestApiClient(props)).toThrow("Base URL must be provided");
  });

  test.each([
    { case: "zero", timeoutMs: 0 },
    { case: "negative", timeoutMs: -1 },
    { case: "NaN", timeoutMs: Number.NaN },
    { case: "Infinity", timeoutMs: Infinity },
  ])("rejects $case timeoutMs", ({ timeoutMs }) => {
    expect(() => createClient(resolvedFetch(), { timeoutMs })).toThrow(
      "timeoutMs must be a positive finite number"
    );
  });

  test("accepts positive timeoutMs", () => {
    expect(() => createClient(resolvedFetch(), { timeoutMs: 1 })).not.toThrow();
  });

  test("uses global fetch when fetchFn is omitted", async () => {
    const originalFetch = globalThis.fetch;
    const globalFetch = resolvedFetch(new Response(null, { status: 204 }));
    globalThis.fetch = globalFetch;

    try {
      const client = new TestApiClient({ baseUrl: "http://localhost:3000" });

      await client.send(new TestRequestCommand({ method: HttpMethod.DELETE }));

      const call = getFetchCall(globalFetch);
      expect(call.url).toBe("http://localhost:3000/todos");
      expect(call.init).toMatchObject({ method: HttpMethod.DELETE });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ApiClient URL construction", () => {
  test.each([
    {
      case: "origin-only base URL with leading slash path",
      baseUrl: "http://localhost:3000",
      path: "/todos",
      expectedUrl: "http://localhost:3000/todos",
    },
    {
      case: "base URL path without trailing slash",
      baseUrl: "http://localhost:3000/api",
      path: "/todos",
      expectedUrl: "http://localhost:3000/api/todos",
    },
    {
      case: "base URL path with trailing slash",
      baseUrl: "http://localhost:3000/api/",
      path: "/todos",
      expectedUrl: "http://localhost:3000/api/todos",
    },
    {
      case: "relative base path",
      baseUrl: "/api",
      path: "/todos",
      expectedUrl: "/api/todos",
    },
    {
      case: "command path without leading slash",
      baseUrl: "http://localhost:3000/api",
      path: "todos",
      expectedUrl: "http://localhost:3000/api/todos",
    },
  ])("joins $case", async ({ baseUrl, path, expectedUrl }) => {
    const { mockFetch } = await sendRaw({ path }, { baseUrl });

    expect(getFetchCall(mockFetch).url).toBe(expectedUrl);
  });
});

describe("ApiClient query string construction", () => {
  test("appends scalar query values", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos",
      query: { status: "TODO", page: "2" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?status=TODO&page=2"
    );
  });

  test("repeats array query keys in order", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos",
      query: { tag: ["api", "client"] },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?tag=api&tag=client"
    );
  });

  test("skips undefined scalar values and undefined array items", async () => {
    const query = {
      status: "TODO",
      priority: undefined,
      tag: ["api", undefined, "client"],
    } as unknown as IHttpQuery;

    const { mockFetch } = await sendRaw({ path: "/todos", query });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?status=TODO&tag=api&tag=client"
    );
  });

  test("encodes special characters, spaces, and unicode through URLSearchParams", async () => {
    const { mockFetch } = await sendRaw({
      path: "/search",
      query: { q: "hello world/ä+?", marker: "#☃" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/search?q=hello+world%2F%C3%A4%2B%3F&marker=%23%E2%98%83"
    );
  });

  test("omits trailing question mark when query is absent", async () => {
    const { mockFetch } = await sendRaw({ path: "/todos" });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos");
  });

  test("omits trailing question mark when serialized query is empty", async () => {
    const query = {
      priority: undefined,
      emptyTags: [],
      skippedTags: [undefined, undefined],
    } as unknown as IHttpQuery;

    const { mockFetch } = await sendRaw({ path: "/todos", query });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos");
  });
});

describe("ApiClient path parameters", () => {
  test("percent-encodes reserved characters, spaces, percent signs, plus signs, and unicode", async () => {
    const { mockFetch } = await sendRaw({
      path: "/files/:fileId/content",
      param: { fileId: "a b/c?#%+☃" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/files/a%20b%2Fc%3F%23%25%2B%E2%98%83/content"
    );
  });

  test("preserves an empty string path parameter value", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos/:todoId",
      param: { todoId: "" },
    });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos/");
  });

  test.each([".", ".."] as const)(
    "rejects dot-segment path parameter value %s before fetch",
    async fileId => {
      const mockFetch = resolvedFetch();
      const client = createClient(mockFetch);
      const command = new TestRequestCommand({
        path: "/files/:fileId/content",
        param: { fileId },
      });

      await expectPathParameterRejection(client.send(command), {
        paramName: "fileId",
        path: "/files/:fileId/content",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );

  test("rejects extra path parameter not present in the template before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/todos/:todoId",
      param: { todoId: "abc", extra: "ignored" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "extra",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects a missing path parameter before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({ path: "/todos/:todoId" });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects an own undefined path parameter before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const param = { todoId: undefined } as unknown as IHttpParam;
    const command = new TestRequestCommand({
      path: "/todos/:todoId",
      param,
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects an inherited path parameter before fetch", async () => {
    const inheritedParam = Object.create({ todoId: "abc" }) as IHttpParam;
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/todos/:todoId",
      param: inheritedParam,
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects an incomplete path parameter map before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/orgs/:orgId/todos/:todoId",
      param: { orgId: "org_123" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/orgs/:orgId/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("replaces repeated placeholders with the same encoded value", async () => {
    const { mockFetch } = await sendRaw({
      path: "/orgs/:orgId/items/:orgId",
      param: { orgId: "rexeus/api" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/orgs/rexeus%2Fapi/items/rexeus%2Fapi"
    );
  });

  test("does not partially replace longer placeholder names", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/items/:idPart",
      param: { id: "abc" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "id",
      path: "/items/:idPart",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects path parameters when the path has no placeholders before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/todos",
      param: { todoId: "abc" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("ApiClient request serialization", () => {
  test.each([
    { case: "undefined", body: undefined },
    { case: "null", body: null },
  ])("omits $case request bodies", async ({ body }) => {
    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.body).toBeUndefined();
  });

  test("sends string bodies as-is", async () => {
    const { mockFetch } = await sendRaw({
      method: HttpMethod.POST,
      body: "hello",
    });

    expect(getFetchCall(mockFetch).init.body).toBe("hello");
  });

  test("JSON-stringifies plain object bodies", async () => {
    const body = { title: "Write tests", completed: false };

    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.body).toBe(JSON.stringify(body));
  });

  test("throws native TypeError for circular object bodies before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const command = new TestRequestCommand({
      method: HttpMethod.POST,
      body: circular,
    });

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) => {
      return error instanceof TypeError && !(error instanceof NetworkError);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test.each([
    { case: "Blob", body: new Blob(["hello"], { type: "text/plain" }) },
    { case: "ArrayBuffer", body: new ArrayBuffer(8) },
    { case: "Uint8Array", body: new Uint8Array([1, 2, 3]) },
    { case: "FormData", body: new FormData() },
    { case: "URLSearchParams", body: new URLSearchParams({ key: "value" }) },
    {
      case: "ReadableStream",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    },
  ])("passes native $case bodies through as-is", async ({ body }) => {
    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.body).toBe(body);
  });
});

describe("ApiClient request header flattening", () => {
  test("passes undefined headers as undefined", async () => {
    const { mockFetch } = await sendRaw({ header: undefined });

    expect(getFetchCall(mockFetch).init.headers).toBeUndefined();
  });

  test("omits undefined header values while preserving empty strings, scalars, and arrays", async () => {
    const header = {
      "X-Empty-Value": "",
      "X-Scalar-Value": "present",
      "X-Multi-Value": ["first", "second"],
      "X-Undefined-Value": undefined,
    } as unknown as IHttpHeader;

    const { mockFetch } = await sendRaw({ header });

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      "X-Empty-Value": "",
      "X-Multi-Value": "first, second",
      "X-Scalar-Value": "present",
    });
  });
});

describe("ApiClient response parsing", () => {
  test.each([
    { case: "204 No Content", status: 204 },
    { case: "304 Not Modified", status: 304 },
  ])(
    "returns undefined body for $case even with content-type",
    async ({ status }) => {
      const mockFetch = resolvedFetch(
        new Response(null, {
          status,
          headers: { "content-type": "application/json" },
        })
      );
      const client = createClient(mockFetch);

      const result = await client.send(new TestRequestCommand());

      expect(result.body).toBeUndefined();
    }
  );

  test("returns undefined body for empty text responses", async () => {
    const mockFetch = resolvedFetch(new Response("", { status: 200 }));
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeUndefined();
  });

  test("returns undefined body for empty JSON responses", async () => {
    const mockFetch = resolvedFetch(
      new Response("", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeUndefined();
  });

  test.each([
    { case: "application/json", contentType: "application/json" },
    {
      case: "application/json with charset",
      contentType: "application/json; charset=utf-8",
    },
    { case: "+json media type", contentType: "application/problem+json" },
    { case: "case-insensitive JSON", contentType: "Application/JSON" },
    {
      case: "case-insensitive +json",
      contentType: "APPLICATION/PROBLEM+JSON",
    },
  ])("parses $case responses as JSON", async ({ contentType }) => {
    const mockFetch = resolvedFetch(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": contentType },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toEqual({ ok: true });
  });

  test("throws ResponseParseError with status, bounded preview, and cause for invalid JSON", async () => {
    const body = `{${"x".repeat(250)}`;
    const mockFetch = resolvedFetch(
      new Response(body, {
        status: 502,
        headers: { "content-type": "application/json" },
      })
    );
    const client = createClient(mockFetch);

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 502 &&
          error.bodyPreview === body.slice(0, 200) &&
          error.bodyPreview.length === 200 &&
          error.cause instanceof SyntaxError
        );
      }
    );
  });

  test("returns text/plain responses as strings", async () => {
    const mockFetch = resolvedFetch(
      new Response("plain text", {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBe("plain text");
  });

  test("returns case-insensitive text content types as strings", async () => {
    const mockFetch = resolvedFetch(
      new Response("plain text", {
        status: 200,
        headers: { "content-type": "TEXT/PLAIN; charset=UTF-8" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBe("plain text");
  });

  test("returns responses with no content-type as strings", async () => {
    const mockFetch = resolvedFetch(new Response("raw text", { status: 200 }));
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBe("raw text");
  });

  test("returns application/octet-stream responses as ArrayBuffer", async () => {
    const mockFetch = resolvedFetch(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(result.body as ArrayBuffer))).toEqual([
      1, 2, 3,
    ]);
  });

  test("returns empty application/octet-stream responses as zero-length ArrayBuffer", async () => {
    const mockFetch = resolvedFetch(
      new Response(new Uint8Array([]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.body).toBeInstanceOf(ArrayBuffer);
    expect((result.body as ArrayBuffer).byteLength).toBe(0);
  });

  test("wraps response body read failures as ResponseParseError", async () => {
    const cause = new Error("body stream interrupted");
    const response = new Response("body", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    vi.spyOn(response, "text").mockRejectedValue(cause);
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 200 &&
          error.bodyPreview === "" &&
          error.cause === cause &&
          error.message.includes("Failed to read response body")
        );
      }
    );
  });

  test("wraps binary response body read failures as ResponseParseError", async () => {
    const cause = new Error("binary stream interrupted");
    const response = new Response(new Uint8Array([1]), {
      status: 206,
      headers: { "content-type": "application/octet-stream" },
    });
    vi.spyOn(response, "arrayBuffer").mockRejectedValue(cause);
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ResponseParseError &&
          error.statusCode === 206 &&
          error.bodyPreview === "" &&
          error.cause === cause &&
          error.message.includes("Failed to read response body")
        );
      }
    );
  });
});

describe("ApiClient response headers", () => {
  test("copies response headers into a plain object", async () => {
    const mockFetch = resolvedFetch(
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_123",
        },
      })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header).toStrictEqual({
      "content-type": "application/json",
      "x-request-id": "req_123",
    });
  });

  test("preserves native Headers comma-join behavior for repeated non-cookie headers", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("x-custom", "first");
    headers.append("x-custom", "second");
    const mockFetch = resolvedFetch(
      new Response("{}", { status: 200, headers })
    );
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header?.["x-custom"]).toBe("first, second");
  });

  test("preserves native getSetCookie values as a string array when available", async () => {
    const response = new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    Object.defineProperty(response.headers, "getSetCookie", {
      value: () => ["a=1; Path=/", "b=2; Path=/"],
    });
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header?.["set-cookie"]).toStrictEqual([
      "a=1; Path=/",
      "b=2; Path=/",
    ]);
  });

  test("preserves a single native getSetCookie value as a string array", async () => {
    const response = new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    Object.defineProperty(response.headers, "getSetCookie", {
      value: () => ["sid=abc; Path=/"],
    });
    const mockFetch = resolvedFetch(response);
    const client = createClient(mockFetch);

    const result = await client.send(new TestRequestCommand());

    expect(result.header?.["set-cookie"]).toStrictEqual(["sid=abc; Path=/"]);
  });
});

describe("ApiClient network errors and timeout signals", () => {
  test.each([
    { code: "ECONNREFUSED", message: "Connection refused" },
    { code: "ECONNRESET", message: "Connection reset by peer" },
    { code: "ENOTFOUND", message: "DNS lookup failed" },
    { code: "ETIMEDOUT", message: "Connection timed out" },
  ] satisfies ReadonlyArray<{
    readonly code: NetworkErrorCode;
    readonly message: string;
  }>)(
    "maps Node-like $code fetch failures to NetworkError",
    async ({ code, message }) => {
      const cause = Object.assign(new TypeError("fetch failed"), {
        cause: { code },
      });
      const client = createClient(rejectedFetch(cause));

      await expect(
        client.send(
          new TestRequestCommand({
            path: "/todos/:todoId",
            param: { todoId: "abc" },
          })
        )
      ).rejects.toSatisfy((error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === code &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc" &&
          error.cause === cause &&
          error.message ===
            `Network error: ${message} (GET http://localhost:3000/todos/abc)`
        );
      });
    }
  );

  test("maps unknown TypeError fetch failures to UNKNOWN NetworkError", async () => {
    const cause = new TypeError("fetch failed");
    const client = createClient(rejectedFetch(cause));

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "UNKNOWN" &&
          error.cause === cause &&
          error.message ===
            "Network error: fetch failed (GET http://localhost:3000/todos)"
        );
      }
    );
  });

  test("maps non-Error fetch rejections to UNKNOWN NetworkError", async () => {
    const client = createClient(rejectedFetch("something broke"));

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "UNKNOWN" &&
          error.cause === "something broke" &&
          error.message ===
            "Network error: something broke (GET http://localhost:3000/todos)"
        );
      }
    );
  });

  test.each([
    { case: "AbortError", name: "AbortError", code: "ABORT" },
    { case: "TimeoutError", name: "TimeoutError", code: "TIMEOUT" },
  ] as const)(
    "maps $case fetch failures to $code NetworkError",
    async ({ name, code }) => {
      const cause = new DOMException("request failed", name);
      const client = createClient(rejectedFetch(cause));

      await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
        (error: unknown) => {
          return (
            error instanceof NetworkError &&
            error.code === code &&
            error.cause === cause &&
            error.method === "GET" &&
            error.url === "http://localhost:3000/todos"
          );
        }
      );
    }
  );

  test.each([
    { case: "AbortError", name: "AbortError", code: "ABORT" },
    { case: "TimeoutError", name: "TimeoutError", code: "TIMEOUT" },
  ] as const)(
    "maps non-DOM $case fetch failures to $code NetworkError",
    async ({ name, code }) => {
      const cause = new Error("request failed");
      cause.name = name;
      const client = createClient(rejectedFetch(cause));

      await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
        (error: unknown) => {
          return (
            error instanceof NetworkError &&
            error.code === code &&
            error.cause === cause &&
            error.method === "GET" &&
            error.url === "http://localhost:3000/todos"
          );
        }
      );
    }
  );

  test("omits the abort signal when timeoutMs is not configured", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);

    await client.send(new TestRequestCommand());

    expect(getFetchCall(mockFetch).init.signal).toBeUndefined();
  });

  test("passes an abort signal when timeoutMs is configured", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch, { timeoutMs: 1000 });

    await client.send(new TestRequestCommand());

    expect(getFetchCall(mockFetch).init.signal).toBeInstanceOf(AbortSignal);
  });

  test("aborts an in-flight request when timeoutMs elapses", async () => {
    const cause = new DOMException("timed out", "TimeoutError");
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);
    const mockFetch = vi.fn<typeof globalThis.fetch>((_input, init) => {
      const signal = init?.signal;
      if (signal == null) {
        return Promise.reject(new Error("Expected fetch to receive a signal"));
      }

      return new Promise<Response>((_resolve, reject) => {
        if (signal.aborted) {
          reject(cause);
          return;
        }

        signal.addEventListener("abort", () => reject(cause), { once: true });
      });
    });
    const client = createClient(mockFetch, { timeoutMs: 50 });

    try {
      const request = client.send(
        new TestRequestCommand({
          path: "/todos/:todoId",
          param: { todoId: "abc" },
        })
      );
      timeoutController.abort(cause);

      await expect(request).rejects.toSatisfy((error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "TIMEOUT" &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc" &&
          error.cause === cause
        );
      });
      expect(timeoutSpy).toHaveBeenCalledWith(50);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});

describe("ApiClient error classes", () => {
  test("NetworkError exposes name, message, metadata, and cause", () => {
    const cause = new TypeError("fetch failed");
    const error = new NetworkError(
      "Connection refused",
      "ECONNREFUSED",
      "POST",
      "http://localhost:3000/api",
      { cause }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NetworkError");
    expect(error.message).toBe("Connection refused");
    expect(error.code).toBe("ECONNREFUSED");
    expect(error.method).toBe("POST");
    expect(error.url).toBe("http://localhost:3000/api");
    expect(error.cause).toBe(cause);
  });

  test("PathParameterError exposes name, message, metadata, and cause", () => {
    const cause = new Error("underlying issue");
    const error = new PathParameterError(
      "Path parameter 'slug' is not found in path '/posts/:id'",
      "slug",
      "/posts/:id",
      { cause }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("PathParameterError");
    expect(error.message).toBe(
      "Path parameter 'slug' is not found in path '/posts/:id'"
    );
    expect(error.paramName).toBe("slug");
    expect(error.path).toBe("/posts/:id");
    expect(error.cause).toBe(cause);
  });

  test("ResponseParseError exposes name, message, metadata, and cause", () => {
    const cause = new SyntaxError("Unexpected token");
    const error = new ResponseParseError(
      "Failed to parse",
      502,
      "<html>Bad Gateway</html>",
      { cause }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ResponseParseError");
    expect(error.message).toBe("Failed to parse");
    expect(error.statusCode).toBe(502);
    expect(error.bodyPreview).toBe("<html>Bad Gateway</html>");
    expect(error.cause).toBe(cause);
  });
});
