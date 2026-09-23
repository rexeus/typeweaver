import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  ClientHttpHeader,
  ClientHttpParam,
  ClientHttpQuery,
  IHttpBody,
  IHttpResponse,
} from "@rexeus/typeweaver-core";
import { TestAssertionError } from "test-utils";
import { expect, vi } from "vitest";
import { ApiClient } from "../../../src/lib/ApiClient.js";
import { PathParameterError } from "../../../src/lib/PathParameterError.js";
import { RequestCommand } from "../../../src/lib/RequestCommand.js";
import { RequestSerializationError } from "../../../src/lib/RequestSerializationError.js";
import { constructWithUncheckedInput } from "../../helpers.js";
import type { ApiClientProps } from "../../../src/lib/ApiClient.js";

export type TestRequestCommandProps = {
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly header?: ClientHttpHeader;
  readonly param?: ClientHttpParam;
  readonly query?: ClientHttpQuery;
  readonly body?: IHttpBody;
};

export class TestApiClient extends ApiClient {
  public constructor(props: ApiClientProps) {
    super(props);
  }

  public send(command: RequestCommand): Promise<IHttpResponse> {
    return this.execute(command);
  }
}

export class TestRequestCommand extends RequestCommand {
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

export function resolvedFetch(
  response: Response = new Response(null, { status: 204 })
) {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
}

export function createClient(
  mockFetch: typeof globalThis.fetch = resolvedFetch(),
  props: Partial<ApiClientProps> = {}
): TestApiClient {
  return new TestApiClient({
    baseUrl: "http://localhost:3000",
    fetchFn: mockFetch,
    ...props,
  });
}

export function getFetchCall(mockFetch: typeof globalThis.fetch): {
  readonly url: string;
  readonly init: RequestInit;
} {
  const call = vi.mocked(mockFetch).mock.calls[0];
  if (!call) {
    throw new TestAssertionError("Expected fetch to have been called");
  }

  const [url, init] = call;
  if (typeof url !== "string") {
    throw new TestAssertionError("Expected fetch to receive a string URL");
  }

  return { url, init: init ?? {} };
}

/** Builds a client from props a JavaScript caller passed without type checks. */
export function aClientWithUncheckedProps(props: unknown): TestApiClient {
  return constructWithUncheckedInput(TestApiClient, props);
}

/**
 * Builds a command carrying raw header, param, or query values outside the
 * client HTTP types, as a JavaScript caller can hand them to ApiClient.
 */
export function anUncheckedCommand(props: unknown): TestRequestCommand {
  return constructWithUncheckedInput(TestRequestCommand, props);
}

function toCommand(
  command: TestRequestCommandProps | TestRequestCommand
): TestRequestCommand {
  return command instanceof TestRequestCommand
    ? command
    : new TestRequestCommand(command);
}

export async function expectPathParameterRejection(
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

export async function sendRaw(
  command: TestRequestCommandProps | TestRequestCommand,
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

  const result = await client.send(toCommand(command));

  return { result, mockFetch };
}

export async function expectRequestSerializationFailure(
  command: TestRequestCommandProps | TestRequestCommand,
  expected: {
    readonly key: string;
    readonly location: string;
    readonly reason: string;
    readonly valueType: string;
  }
): Promise<void> {
  const mockFetch = resolvedFetch();
  const client = createClient(mockFetch);

  await expect(client.send(toCommand(command))).rejects.toSatisfy(
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
