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

describe("ApiClient path parameter invariants", () => {
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
    const param = { todoId: undefined } as unknown as ClientHttpParam;
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
    const inheritedParam = Object.create({
      todoId: "abc",
    }) as ClientHttpParam;
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
});

describe("ApiClient path parameter replacement", () => {
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

describe("ApiClient default headers", () => {
  test("treats header names case-insensitively when request headers override defaults", async () => {
    const { mockFetch } = await sendRaw(
      {
        header: {
          authorization: "Bearer request",
        },
      },
      {
        defaultHeaders: {
          Authorization: "Bearer default",
          "X-Default": "default",
        },
      }
    );

    expect([
      ...new Headers(getFetchCall(mockFetch).init.headers).entries(),
    ]).toStrictEqual([
      ["authorization", "Bearer request"],
      ["x-default", "default"],
    ]);
  });
});

describe("ApiClient request serialization", () => {
  test("merges default headers while request headers take precedence", async () => {
    const { mockFetch } = await sendRaw(
      {
        header: {
          Authorization: "Bearer request",
          "X-Request": "request",
        },
      },
      {
        defaultHeaders: {
          Authorization: "Bearer default",
          "X-Default": "default",
        },
      }
    );

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      Authorization: "Bearer request",
      "X-Default": "default",
      "X-Request": "request",
    });
  });

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

  test.each([
    { case: "plain object", body: { title: "Write tests" } },
    { case: "array", body: [{ title: "Write tests" }] },
  ])(
    "adds application/json content-type for JSON-stringified $case bodies",
    async ({ body }) => {
      const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

      expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
    }
  );
});
