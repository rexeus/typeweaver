import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  ClientHttpHeader,
  ClientHttpParam,
  ClientHttpQuery,
  IHttpBody,
  IHttpResponse,
} from "@rexeus/typeweaver-core";
import { NamedTestError, TestIoError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { ApiClient } from "../../src/lib/ApiClient.js";
import { NetworkError } from "../../src/lib/NetworkError.js";
import { RequestCommand } from "../../src/lib/RequestCommand.js";
import { ResponseParseError } from "../../src/lib/ResponseParseError.js";
import type { ApiClientProps } from "../../src/lib/ApiClient.js";
import type { NetworkErrorCode } from "../../src/lib/NetworkError.js";

type TestRequestCommandProps = {
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly header?: ClientHttpHeader;
  readonly param?: ClientHttpParam;
  readonly query?: ClientHttpQuery;
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
  public override readonly header: ClientHttpHeader;
  public override readonly param: ClientHttpParam;
  public override readonly query: ClientHttpQuery;
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

describe("ApiClient text and binary response parsing", () => {
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
});

describe("ApiClient response body read failures", () => {
  test("wraps response body read failures as ResponseParseError", async () => {
    const cause = new TestIoError("body stream interrupted");
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
    const cause = new TestIoError("binary stream interrupted");
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
});

describe("ApiClient unknown network errors", () => {
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
      const cause = new NamedTestError(name, "request failed");
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
});
