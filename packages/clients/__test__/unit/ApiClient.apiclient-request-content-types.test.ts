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
import { NetworkError } from "../../src/lib/NetworkError.js";
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

describe("ApiClient request content types", () => {
  test("preserves unrelated headers when adding JSON content-type", async () => {
    const { mockFetch } = await sendRaw({
      method: HttpMethod.POST,
      header: { Authorization: "Bearer token" },
      body: { title: "Write tests" },
    });

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    });
  });

  test.each([
    { case: "true boolean", body: true, expectedBody: "true" },
    { case: "positive number", body: 42, expectedBody: "42" },
    { case: "zero", body: 0, expectedBody: "0" },
  ])(
    "adds application/json content-type for JSON-stringified $case bodies",
    async ({ body, expectedBody }) => {
      const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

      const { init } = getFetchCall(mockFetch);
      expect(init.body).toBe(expectedBody);
      expect(init.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
    }
  );

  test.each([
    {
      case: "canonical",
      header: {
        "Content-Type": "application/vnd.api+json",
      } as ClientHttpHeader,
    },
    {
      case: "lowercase",
      header: {
        "content-type": "application/vnd.api+json",
      } as ClientHttpHeader,
    },
  ])(
    "preserves user-provided $case content-type for JSON bodies",
    async ({ header }) => {
      const { mockFetch } = await sendRaw({
        method: HttpMethod.POST,
        header,
        body: { title: "Write tests" },
      });

      expect(getFetchCall(mockFetch).init.headers).toStrictEqual(header);
    }
  );
});

describe("ApiClient cancellation", () => {
  test("forwards an external AbortSignal to fetch", async () => {
    const abortController = new AbortController();
    const { mockFetch } = await sendRaw(
      { method: HttpMethod.GET },
      { signal: abortController.signal }
    );

    expect(getFetchCall(mockFetch).init.signal).toBe(abortController.signal);
  });
});

describe("ApiClient request serialization failures", () => {
  test("throws native TypeError for circular object bodies before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
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

  test.each([
    { case: "undefined", body: undefined },
    { case: "null", body: null },
    { case: "string", body: "hello" },
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
  ])("does not add content-type for $case bodies", async ({ body }) => {
    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.headers).toBeUndefined();
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
      "X-Empty-Array": [],
      "X-Scalar-Value": "present",
      "X-Multi-Value": ["first", "second"],
      "X-Undefined-Value": undefined,
    } as unknown as ClientHttpHeader;

    const { mockFetch } = await sendRaw({ header });

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      "X-Empty-Array": "",
      "X-Empty-Value": "",
      "X-Multi-Value": "first, second",
      "X-Scalar-Value": "present",
    });
  });
});
