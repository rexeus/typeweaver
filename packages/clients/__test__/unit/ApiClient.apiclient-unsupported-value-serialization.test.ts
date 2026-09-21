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
import { PathParameterError } from "../../src/lib/PathParameterError.js";
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

describe("ApiClient unsupported value serialization", () => {
  test.each([
    {
      case: "null query value",
      command: {
        query: { filter: null } as unknown as ClientHttpQuery,
      },
      expected: {
        location: "query",
        key: "filter",
        reason: "null-value",
        valueType: "null",
      },
    },
    {
      case: "nested query array",
      command: {
        query: { filters: [["nested"]] } as unknown as ClientHttpQuery,
      },
      expected: {
        location: "query",
        key: "filters",
        reason: "nested-array",
        valueType: "array",
      },
    },
    {
      case: "object query value",
      command: {
        query: { filter: { status: "open" } } as unknown as ClientHttpQuery,
      },
      expected: {
        location: "query",
        key: "filter",
        reason: "unsupported-type",
        valueType: "object",
      },
    },
    {
      case: "function header value",
      command: {
        header: { "X-Value": () => "value" } as unknown as ClientHttpHeader,
      },
      expected: {
        location: "header",
        key: "X-Value",
        reason: "unsupported-type",
        valueType: "function",
      },
    },
    {
      case: "symbol path value",
      command: {
        path: "/metrics/:metricId",
        param: {
          metricId: Symbol("metric"),
        } as unknown as ClientHttpParam,
      },
      expected: {
        location: "path",
        key: "metricId",
        reason: "unsupported-type",
        valueType: "symbol",
      },
    },
  ])("rejects $case before fetch", async ({ command, expected }) => {
    await expectRequestSerializationFailure(command, expected);
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

  test("rejects a null path parameter with a null-value serialization error", async () => {
    await expectRequestSerializationFailure(
      {
        path: "/todos/:todoId",
        param: { todoId: null } as unknown as ClientHttpParam,
      },
      {
        location: "path",
        key: "todoId",
        reason: "null-value",
        valueType: "null",
      }
    );
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

  test.each(["%2E", "%2E%2E", "%2e%2e"] as const)(
    "double-encodes percent-encoded dot-segment %s rather than rejecting",
    async fileId => {
      const { mockFetch } = await sendRaw({
        path: "/files/:fileId/content",
        param: { fileId },
      });

      const url = getFetchCall(mockFetch).url;
      expect(url).toBe(
        `http://localhost:3000/files/${encodeURIComponent(fileId)}/content`
      );
      expect(url).not.toMatch(/\/\.\.?\//);
    }
  );

  test("rejects a __proto__ path parameter without an own value before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/items/:__proto__",
      param: {} as ClientHttpParam,
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "__proto__",
      path: "/items/:__proto__",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
