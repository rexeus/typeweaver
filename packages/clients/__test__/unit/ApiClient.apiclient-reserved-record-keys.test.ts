import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  ClientHttpHeader,
  ClientHttpParam,
  ClientHttpQuery,
  IHttpBody,
  IHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestAssertionError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { ApiClient } from "../../src/lib/ApiClient.js";
import { RequestCommand } from "../../src/lib/RequestCommand.js";
import { RequestSerializationError } from "../../src/lib/RequestSerializationError.js";
import { ResponseParseError } from "../../src/lib/ResponseParseError.js";
import type { ApiClientProps } from "../../src/lib/ApiClient.js";

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
    throw new TestAssertionError("Expected fetch to have been called");
  }

  return {
    url: call[0] as string,
    init: call[1] ?? {},
  };
}

async function expectRequestSerializationFailure(
  command: TestRequestCommandProps,
  expected: {
    readonly key: string;
    readonly location: string;
    readonly reason: string;
    readonly valueType: string;
  }
): Promise<void> {
  const mockFetch = resolvedFetch();
  const client = createClient(mockFetch);

  await expect(client.send(new TestRequestCommand(command))).rejects.toSatisfy(
    (error: unknown) => {
      return (
        error instanceof RequestSerializationError &&
        error.code === "REQUEST_SERIALIZATION_ERROR" &&
        error.location === expected.location &&
        error.key === expected.key &&
        error.reason === expected.reason &&
        error.valueType === expected.valueType &&
        error.message.includes(expected.key)
      );
    }
  );
  expect(mockFetch).not.toHaveBeenCalled();
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

describe("ApiClient reserved record keys", () => {
  const withOwnProtoKey = <TValue>(value: TValue): Record<string, TValue> => {
    const record: Record<string, TValue> = {};
    Object.defineProperty(record, "__proto__", {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return record;
  };

  test("rejects an own __proto__ query key before fetch", async () => {
    await expectRequestSerializationFailure(
      { query: withOwnProtoKey("value") },
      {
        location: "query",
        key: "__proto__",
        reason: "reserved-key",
        valueType: "string",
      }
    );
  });

  test("rejects an own __proto__ header key before fetch", async () => {
    await expectRequestSerializationFailure(
      { header: withOwnProtoKey("value") },
      {
        location: "header",
        key: "__proto__",
        reason: "reserved-key",
        valueType: "string",
      }
    );
  });

  test("rejects an own __proto__ path parameter before fetch", async () => {
    await expectRequestSerializationFailure(
      { path: "/todos/:todoId", param: withOwnProtoKey("value") },
      {
        location: "path",
        key: "__proto__",
        reason: "reserved-key",
        valueType: "string",
      }
    );
  });

  test("serializes ordinary embedded path placeholders", async () => {
    const { mockFetch } = await sendRaw({
      path: "/files/:fileId.:format",
      param: { fileId: "report", format: "json" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/files/report.json"
    );
  });

  test("escapes embedded delimiters inside path parameter values", async () => {
    const { mockFetch } = await sendRaw({
      path: "/files/:fileId.:format",
      param: { fileId: "quarter.1", format: "json" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/files/quarter%2E1.json"
    );
  });

  test("serializes constructor and toString path parameters", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos/:constructor/:toString",
      param: { constructor: "a", toString: "b" },
    });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos/a/b");
  });

  test("serializes constructor and toString query and header keys", async () => {
    const query: Record<string, string> = {
      constructor: "c",
      toString: "t",
    };
    const header: Record<string, string> = {
      constructor: "c",
      toString: "t",
    };

    const { mockFetch } = await sendRaw({ query, header });
    const call = getFetchCall(mockFetch);

    expect(call.url).toContain("constructor=c");
    expect(call.url).toContain("toString=t");
    expect(call.init.headers).toMatchObject({
      constructor: "c",
      toString: "t",
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
});
