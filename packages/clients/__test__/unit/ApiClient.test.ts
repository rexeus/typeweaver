import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  ClientHttpHeader,
  ClientHttpParam,
  ClientHttpQuery,
  IHttpBody,
  IHttpResponse,
} from "@rexeus/typeweaver-core";
import { captureError, TestAssertionError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { ApiClient } from "../../src/lib/ApiClient.js";
import { ApiClientConfigurationError } from "../../src/lib/errors/ApiClientConfigurationError.js";
import { RequestCommand } from "../../src/lib/RequestCommand.js";
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

function captureApiClientConfigurationError(
  action: () => void
): ApiClientConfigurationError {
  const error = captureError(action);

  if (!(error instanceof ApiClientConfigurationError)) {
    throw new TestAssertionError(
      "Expected ApiClientConfigurationError to be thrown"
    );
  }

  return error;
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
    {
      case: "mixed-case HTTP absolute base URL",
      baseUrl: "HTTP://localhost:3000",
    },
    {
      case: "mixed-case HTTPS absolute base URL",
      baseUrl: "HtTpS://api.example.com",
    },
    { case: "relative base path", baseUrl: "/api" },
    { case: "relative base path with colon", baseUrl: "/api:v1" },
    { case: "relative base path without leading slash", baseUrl: "api" },
  ])("accepts $case", ({ baseUrl }) => {
    expect(() => createClient(resolvedFetch(), { baseUrl })).not.toThrow();
  });

  test.each([
    { case: "FTP", baseUrl: "ftp://api.example.com" },
    { case: "file", baseUrl: "file:///tmp/api" },
    { case: "mailto", baseUrl: "mailto:user@example.com" },
    { case: "javascript", baseUrl: "javascript:alert(1)" },
    { case: "data", baseUrl: "data:text/plain,hello" },
  ])("rejects absolute non-http(s) $case baseUrl", ({ baseUrl }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "unsupported-base-url-scheme",
        scheme: baseUrl.split(":", 1)[0]?.toLowerCase(),
      })
    );
  });

  test.each([
    {
      case: "newline inserted into a javascript scheme",
      baseUrl: "java\nscript:alert(1)",
    },
    {
      case: "leading tab before a data scheme",
      baseUrl: "\tdata:text/plain,hello",
    },
    {
      case: "carriage return inserted after an FTP scheme",
      baseUrl: "ftp:\r//api.example.com",
    },
    {
      case: "malformed HTTP absolute URL",
      baseUrl: "http://%",
    },
  ])("rejects $case baseUrl", ({ baseUrl }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "malformed-base-url",
      })
    );
  });
});

describe("ApiClient base URL validation", () => {
  test("classifies a malformed absolute URL with a visible scheme as malformed", () => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl: "ftp://%" })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl: "ftp://%",
        field: "baseUrl",
        reason: "malformed-base-url",
        scheme: "ftp",
      })
    );
  });

  test("classifies a relative base URL with ASCII control characters as malformed", () => {
    const baseUrl = "/api\nv1";

    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "malformed-base-url",
      })
    );
  });

  test.each([
    { case: "empty", baseUrl: "" },
    { case: "whitespace-only", baseUrl: "   \t\n" },
  ])("rejects $case baseUrl", ({ baseUrl }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { baseUrl })
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl,
        field: "baseUrl",
        reason: "missing-base-url",
      })
    );
  });
});

describe("ApiClient option validation", () => {
  test("rejects a missing baseUrl with the validation error", () => {
    const props = { fetchFn: resolvedFetch() } as unknown as ApiClientProps;

    const error = captureApiClientConfigurationError(
      () => new TestApiClient(props)
    );

    expect(error).toEqual(
      expect.objectContaining({
        field: "baseUrl",
        reason: "missing-base-url",
      })
    );
  });

  test("rejects a non-string baseUrl with the validation error", () => {
    const props = {
      baseUrl: 123 as unknown as string,
      fetchFn: resolvedFetch(),
    } satisfies ApiClientProps;

    const error = captureApiClientConfigurationError(
      () => new TestApiClient(props)
    );

    expect(error).toEqual(
      expect.objectContaining({
        baseUrl: props.baseUrl,
        field: "baseUrl",
        reason: "missing-base-url",
      })
    );
  });

  test.each([
    { case: "zero", timeoutMs: 0 },
    { case: "negative", timeoutMs: -1 },
    { case: "NaN", timeoutMs: Number.NaN },
    { case: "Infinity", timeoutMs: Infinity },
  ])("rejects $case timeoutMs", ({ timeoutMs }) => {
    const error = captureApiClientConfigurationError(() =>
      createClient(resolvedFetch(), { timeoutMs })
    );

    expect(error).toEqual(
      expect.objectContaining({
        field: "timeoutMs",
        reason: "invalid-timeout",
        timeoutMs,
      })
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
