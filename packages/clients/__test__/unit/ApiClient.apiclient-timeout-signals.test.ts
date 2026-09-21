import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  ClientHttpHeader,
  ClientHttpParam,
  ClientHttpQuery,
  IHttpBody,
  IHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestAssertionError, TestIoError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { ApiClient } from "../../src/lib/ApiClient.js";
import { NetworkError } from "../../src/lib/NetworkError.js";
import { PathParameterError } from "../../src/lib/PathParameterError.js";
import { RequestCommand } from "../../src/lib/RequestCommand.js";
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

describe("ApiClient timeout signals", () => {
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
        return Promise.reject(
          new TestAssertionError("Expected fetch to receive a signal")
        );
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
    const error = new NetworkError("Connection refused", {
      cause,
      code: "ECONNREFUSED",
      method: "POST",
      url: "http://localhost:3000/api",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NetworkError");
    expect(error.message).toBe("Connection refused");
    expect(error.code).toBe("ECONNREFUSED");
    expect(error.method).toBe("POST");
    expect(error.url).toBe("http://localhost:3000/api");
    expect(error.cause).toBe(cause);
  });

  test("PathParameterError exposes name, message, metadata, and cause", () => {
    const cause = new TestIoError("underlying issue");
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
