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
    } as unknown as ClientHttpQuery;

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

  test("rejects an empty query array before fetch", async () => {
    await expectRequestSerializationFailure(
      {
        path: "/todos",
        query: { emptyTags: [] } as unknown as ClientHttpQuery,
      },
      {
        location: "query",
        key: "emptyTags",
        reason: "empty-array",
        valueType: "array",
      }
    );
  });

  test("omits trailing question mark when all query values are undefined", async () => {
    const query = {
      priority: undefined,
      skippedTags: [undefined, undefined],
    } as unknown as ClientHttpQuery;

    const { mockFetch } = await sendRaw({ path: "/todos", query });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos");
  });

  test("merges default query values while request values take precedence", async () => {
    const { mockFetch } = await sendRaw(
      {
        path: "/todos",
        query: { page: "2", filter: "open" },
      },
      {
        defaultQuery: { apiKey: "secret", page: "1" },
      }
    );

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/todos?apiKey=secret&page=2&filter=open"
    );
  });
});

describe("ApiClient typed HTTP scalar serialization", () => {
  test("serializes domain scalars consistently across path, query, and headers", async () => {
    const capturedAt = new Date("2026-07-26T10:15:30.000Z");
    const { mockFetch } = await sendRaw({
      path: "/metrics/:metricId",
      param: { metricId: 42 },
      query: {
        enabled: false,
        count: 7,
        sequence: 9007199254740993n,
        capturedAt,
        samples: [1.5, 2, true, 3n, capturedAt],
        omitted: undefined,
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Sequence": 9007199254740993n,
        "X-Observed-At": capturedAt,
        "X-Values": [1, false, 2n, capturedAt],
        "X-Omitted": undefined,
      },
    });

    const { url, init } = getFetchCall(mockFetch);
    const parsedUrl = new URL(url);

    expect(parsedUrl.pathname).toBe("/metrics/42");
    expect([...parsedUrl.searchParams.entries()]).toEqual([
      ["enabled", "false"],
      ["count", "7"],
      ["sequence", "9007199254740993"],
      ["capturedAt", "2026-07-26T10:15:30.000Z"],
      ["samples", "1.5"],
      ["samples", "2"],
      ["samples", "true"],
      ["samples", "3"],
      ["samples", "2026-07-26T10:15:30.000Z"],
    ]);
    expect(init.headers).toStrictEqual({
      "X-Attempt": "3",
      "X-Enabled": "false",
      "X-Observed-At": "2026-07-26T10:15:30.000Z",
      "X-Sequence": "9007199254740993",
      "X-Values": "1, false, 2, 2026-07-26T10:15:30.000Z",
    });
  });
});

describe("ApiClient invalid scalar serialization", () => {
  test.each([
    {
      case: "NaN query value",
      command: {
        query: { limit: Number.NaN },
      },
      expected: {
        location: "query",
        key: "limit",
        reason: "non-finite-number",
        valueType: "number",
      },
    },
    {
      case: "infinite header value",
      command: {
        header: { "X-Limit": Number.POSITIVE_INFINITY },
      },
      expected: {
        location: "header",
        key: "X-Limit",
        reason: "non-finite-number",
        valueType: "number",
      },
    },
    {
      case: "negative infinite query value",
      command: {
        query: { limit: Number.NEGATIVE_INFINITY },
      },
      expected: {
        location: "query",
        key: "limit",
        reason: "non-finite-number",
        valueType: "number",
      },
    },
    {
      case: "invalid Date path value",
      command: {
        path: "/metrics/:metricId",
        param: { metricId: new Date(Number.NaN) },
      },
      expected: {
        location: "path",
        key: "metricId",
        reason: "invalid-date",
        valueType: "Date",
      },
    },
  ])("rejects $case before fetch", async ({ command, expected }) => {
    await expectRequestSerializationFailure(command, expected);
  });
});
