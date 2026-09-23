import { internalServerErrorDefaultError } from "@rexeus/typeweaver-core";
import type {
  IHttpResponse,
  IRawHttpRequest,
  ITypedHttpResponse,
  IValidatedHttpRequest,
} from "@rexeus/typeweaver-core";
import {
  createCreateTodoSuccessResponseBody,
  TestAssertionError,
  TodoHono,
} from "test-utils";
import { expect } from "vitest";
import type { Context } from "hono";
import type {
  HonoTodoApiHandler,
  TypeweaverHonoRequestOptions,
} from "test-utils";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "an array" : typeof value;
}

/**
 * Fails the test unless `value` is a non-array object, so its properties can be
 * read as `unknown` without asserting a type.
 */
export function expectRecord(
  value: unknown,
  description: string
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TestAssertionError(
      `Expected ${description} to be an object, received ${describeValue(value)}`
    );
  }
}

/**
 * Fails the test unless `value` is an array whose items are read as `unknown`.
 */
export function expectArray(
  value: unknown,
  description: string
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TestAssertionError(
      `Expected ${description} to be an array, received ${describeValue(value)}`
    );
  }
}

/**
 * Reads a property of a value a handler received without failing inside the
 * handler, where a thrown assertion would surface only as a sanitized 500.
 */
export function readField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/**
 * Reads an array item of a value a handler received; see `readField`.
 */
export function readItem(value: unknown, index: number): unknown {
  if (!Array.isArray(value)) return undefined;
  const items: readonly unknown[] = value;
  return items[index];
}

export async function readJsonRecord(
  response: Response
): Promise<Record<string, unknown>> {
  const data: unknown = await response.json();
  expectRecord(data, "the JSON response body");
  return data;
}

/**
 * Replaces fields of a request or response body, including with values its
 * schema rejects. The result keeps the generic message shape, whose body is
 * `unknown`, so deliberately invalid values need no type assertion.
 */
export function withBodyFields<TMessage extends { readonly body?: unknown }>(
  message: TMessage,
  fields: Readonly<Record<string, unknown>>
): Omit<TMessage, "body"> & { readonly body: Record<string, unknown> } {
  const body: unknown = message.body;
  expectRecord(body, "the body to override");
  return { ...message, body: { ...body, ...fields } };
}

/**
 * Replaces request header values, including with values the schema rejects.
 */
export function withHeaderFields(
  request: IValidatedHttpRequest,
  fields: Readonly<Record<string, string>>
): IValidatedHttpRequest {
  return { ...request, header: { ...request.header, ...fields } };
}

function missingTodoHandler(handlerName: string): () => Promise<never> {
  return async () => {
    throw new TestAssertionError(`Missing Hono test handler: ${handlerName}`);
  };
}

/**
 * Builds a complete Todo handler object from the handlers a test provides; every
 * other handler fails the test when a request reaches it.
 */
export function createTodoApiHandlers<TValidateRequests extends boolean>(
  handlers: Partial<HonoTodoApiHandler<TValidateRequests>>
): HonoTodoApiHandler<TValidateRequests> {
  return {
    handleListTodosRequest: missingTodoHandler("handleListTodosRequest"),
    handleCreateTodoRequest: missingTodoHandler("handleCreateTodoRequest"),
    handleQueryTodoRequest: missingTodoHandler("handleQueryTodoRequest"),
    handleGetTodoRequest: missingTodoHandler("handleGetTodoRequest"),
    handlePutTodoRequest: missingTodoHandler("handlePutTodoRequest"),
    handleUpdateTodoRequest: missingTodoHandler("handleUpdateTodoRequest"),
    handleDeleteTodoRequest: missingTodoHandler("handleDeleteTodoRequest"),
    handleOptionsTodoRequest: missingTodoHandler("handleOptionsTodoRequest"),
    handleUpdateTodoStatusRequest: missingTodoHandler(
      "handleUpdateTodoStatusRequest"
    ),
    handleListSubTodosRequest: missingTodoHandler("handleListSubTodosRequest"),
    handleCreateSubTodoRequest: missingTodoHandler(
      "handleCreateSubTodoRequest"
    ),
    handleQuerySubTodoRequest: missingTodoHandler("handleQuerySubTodoRequest"),
    handleUpdateSubTodoRequest: missingTodoHandler(
      "handleUpdateSubTodoRequest"
    ),
    handleDeleteSubTodoRequest: missingTodoHandler(
      "handleDeleteSubTodoRequest"
    ),
    ...handlers,
  };
}

/**
 * A handler whose response is not bound to its operation's contract.
 */
export type UncheckedHonoHandler = (
  request: IRawHttpRequest | IValidatedHttpRequest,
  context: Context
) => Promise<IHttpResponse>;

/**
 * Unchecked handlers keyed by the generated operation id they replace.
 */
export type UncheckedTodoHandlers = Readonly<
  Record<string, UncheckedHonoHandler>
>;

type TodoHonoOptions<TValidateRequests extends boolean> = ConstructorParameters<
  typeof TodoHono<TValidateRequests>
>[0];

/**
 * The generated Todo router with some operations answered by unchecked
 * handlers. A generated handler contract cannot return a response outside its
 * schema, so tests that need one swap the handler at `handleRequest`, the
 * `TypeweaverHono` extension point that accepts any `IHttpResponse`. The
 * generated route, operation id, and validators stay in place.
 */
export class UncheckedResponseTodoHono<
  TValidateRequests extends boolean,
> extends TodoHono<TValidateRequests> {
  private readonly uncheckedHandlers: ReadonlyMap<string, UncheckedHonoHandler>;

  public constructor(
    options: TodoHonoOptions<TValidateRequests>,
    uncheckedHandlers: UncheckedTodoHandlers
  ) {
    super(options);
    this.uncheckedHandlers = new Map(Object.entries(uncheckedHandlers));
  }

  protected override async handleRequest<
    TRequest extends IRawHttpRequest | IValidatedHttpRequest,
    TResponse extends IHttpResponse,
  >(
    options: TypeweaverHonoRequestOptions<TRequest, TResponse>
  ): Promise<Response> {
    const handler = this.uncheckedHandlers.get(options.operationId);
    if (handler === undefined) return await super.handleRequest(options);
    return await super.handleRequest<TRequest, IHttpResponse>({
      ...options,
      handler,
    });
  }
}

/**
 * Converts an IHttpRequest to fetch-compatible RequestInit for Hono's `app.request()`.
 */
export function prepareRequestData(
  requestData: IValidatedHttpRequest
): RequestInit {
  const body =
    typeof requestData.body === "string"
      ? requestData.body
      : requestData.body
        ? JSON.stringify(requestData.body)
        : undefined;

  const headers = new Headers();
  for (const [key, value] of Object.entries(requestData.header ?? {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, String(v));
      }
    } else {
      headers.set(key, String(value));
    }
  }
  return {
    method: requestData.method,
    headers,
    ...(body === undefined ? {} : { body }),
  };
}

/**
 * Builds a typed CreateTodoSuccess response with optional body overrides.
 * Merges overrides with a schema-conformant factory body so all required fields are present.
 */
export function buildCreateTodoSuccess(
  bodyOverrides: Record<string, unknown> = {}
) {
  const base = createCreateTodoSuccessResponseBody();
  return {
    type: "CreateTodoSuccess" as const,
    statusCode: 201,
    header: { "Content-Type": "application/json" },
    body: { ...base, ...bodyOverrides },
  } satisfies ITypedHttpResponse;
}

export function aCreateTodoSuccessResponseWithBody(
  body: unknown,
  overrides: Partial<ITypedHttpResponse> = {}
): ITypedHttpResponse {
  return {
    type: "CreateTodoSuccess" as const,
    statusCode: 201,
    header: { "Content-Type": "application/json" },
    body,
    ...overrides,
  };
}

export async function expectErrorResponse(
  response: Response,
  status: number,
  code: string
): Promise<Record<string, unknown>> {
  expect(response.status).toBe(status);

  const data = await readJsonRecord(response);
  expect(data["code"]).toBe(code);

  if (code === "INTERNAL_SERVER_ERROR") {
    expect(data["message"]).toBe(internalServerErrorDefaultError.message);
  }

  return data;
}
