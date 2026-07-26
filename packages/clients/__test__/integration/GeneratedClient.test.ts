import assert from "node:assert";
import { HttpMethod, UnknownResponseError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  AccessTokenRequestCommand,
  createAccessTokenRequest,
  createCreateTodoRequest,
  createDeleteTodoRequest,
  createForbiddenErrorResponse,
  createGetTodoRequest,
  createHeadTodoRequest,
  createInternalServerErrorResponse,
  createOptionsTodoRequest,
  createPutTodoRequest,
  createTodoNotChangeableErrorResponse,
  createTodoNotFoundErrorResponse,
  CreateTodoRequestCommand,
  createUpdateTodoRequest,
  DeleteTodoRequestCommand,
  GetMetricRequestCommand,
  GetTodoRequestCommand,
  HeadTodoRequestCommand,
  MetricClient,
  OptionsTodoRequestCommand,
  PutTodoRequestCommand,
  TestAssertionError,
  UpdateTodoRequestCommand,
} from "test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { runClientCleanup, setupClientTest } from "./clientSetup.js";

async function captureUnknownResponseError(
  act: () => Promise<unknown>
): Promise<UnknownResponseError> {
  try {
    await act();
  } catch (error) {
    expect(error).toBeInstanceOf(UnknownResponseError);
    assert(error instanceof UnknownResponseError);
    return error;
  }

  throw new TestAssertionError("Expected UnknownResponseError to be thrown");
}

afterEach(async () => {
  await runClientCleanup();
});

describe("Generated Client HTTP methods", () => {
  test("routes generated GET commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createGetTodoRequest();
    const command = new GetTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("GetTodoSuccess");
    assert(response.type === "GetTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(requestData.param.todoId);
  });

  test("routes generated POST commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createCreateTodoRequest();
    const command = new CreateTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("CreateTodoSuccess");
    assert(response.type === "CreateTodoSuccess");
    expect(response.statusCode).toBe(201);
    expect(response.body.title).toBe(requestData.body.title);
  });

  test("routes generated JSON commands when literal request headers are omitted", async () => {
    const { client } = await setupClientTest();
    const requestData = createCreateTodoRequest();
    const command = new CreateTodoRequestCommand({
      header: { Authorization: requestData.header.Authorization },
      body: requestData.body,
    });

    const response = await client.send(command);

    expect(response.type).toBe("CreateTodoSuccess");
    assert(response.type === "CreateTodoSuccess");
    expect(response.statusCode).toBe(201);
    expect(response.body.title).toBe(requestData.body.title);
  });

  test("routes generated PUT commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createPutTodoRequest();
    const command = new PutTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("PutTodoSuccess");
    assert(response.type === "PutTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(requestData.param.todoId);
  });

  test("routes generated PATCH commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createUpdateTodoRequest();
    const command = new UpdateTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("UpdateTodoSuccess");
    assert(response.type === "UpdateTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(requestData.param.todoId);
    expect(response.body.title).toBe(requestData.body.title);
  });
});

describe("Generated Client typed HTTP boundary serialization", () => {
  test("accepts domain scalars and emits deterministic wire values", async () => {
    const fetchFn = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ metricId: 42, enabled: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const client = new MetricClient({
      baseUrl: "https://api.example.test",
      fetchFn,
    });
    const observedAt = new Date("2026-07-26T10:15:30.000Z");
    const command = new GetMetricRequestCommand({
      param: { metricId: 42 },
      query: {
        enabled: false,
        truthy: false,
        capturedAt: observedAt,
        samples: [1.5, 2],
      },
      header: {
        "X-Attempt": 3,
        "X-Enabled": false,
        "X-Observed-At": observedAt,
      },
    });

    const response = await client.send(command);

    expect(response.type).toBe("GetMetricSuccess");
    expect(fetchFn).toHaveBeenCalledOnce();
    const call = fetchFn.mock.calls[0];
    assert(call);
    expect(call[0]).toBe(
      "https://api.example.test/metrics/42?enabled=false&truthy=false&capturedAt=2026-07-26T10%3A15%3A30.000Z&samples=1.5&samples=2"
    );
    expect(call[1]?.headers).toEqual({
      "X-Attempt": "3",
      "X-Enabled": "false",
      "X-Observed-At": "2026-07-26T10:15:30.000Z",
    });
  });
});

describe("Generated Client additional HTTP methods", () => {
  test("routes generated DELETE commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createDeleteTodoRequest();
    const command = new DeleteTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("DeleteTodoSuccess");
    expect(response.statusCode).toBe(204);
    expect(response.body).toBeUndefined();
  });

  test("routes generated HEAD commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createHeadTodoRequest();
    const command = new HeadTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("HeadTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.header["Content-Type"]).toBe("application/json");
    expect(response.body).toBeUndefined();
  });

  test("routes generated OPTIONS commands to the server", async () => {
    const { client } = await setupClientTest();
    const requestData = createOptionsTodoRequest();
    const command = new OptionsTodoRequestCommand(requestData);

    const response = await client.send(command);

    expect(response.type).toBe("OptionsTodoSuccess");
    assert(response.type === "OptionsTodoSuccess");
    expect(response.statusCode).toBe(200);
    expect(response.header.Allow).toContain("PATCH");
  });
});

describe("Generated command metadata", () => {
  test("makes generated headers optional when every required header has a literal default", () => {
    const requestData = createAccessTokenRequest();

    const command = new AccessTokenRequestCommand({ body: requestData.body });

    expect(command.header).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  test.each([
    {
      scenario: "GET by id",
      command: new GetTodoRequestCommand(createGetTodoRequest()),
      expected: {
        operationId: "GetTodo",
        method: HttpMethod.GET,
        path: "/todos/:todoId",
      },
    },
    {
      scenario: "create todo",
      command: new CreateTodoRequestCommand(createCreateTodoRequest()),
      expected: {
        operationId: "CreateTodo",
        method: HttpMethod.POST,
        path: "/todos",
      },
    },
    {
      scenario: "update todo",
      command: new UpdateTodoRequestCommand(createUpdateTodoRequest()),
      expected: {
        operationId: "UpdateTodo",
        method: HttpMethod.PATCH,
        path: "/todos/:todoId",
      },
    },
  ])(
    "emits generated operation metadata for $scenario",
    ({ command, expected }) => {
      expect(command.operationId).toBe(expected.operationId);
      expect(command.method).toBe(expected.method);
      expect(command.path).toBe(expected.path);
    }
  );
});

describe("UpdateTodo Responses", () => {
  test.each([
    {
      scenario: "404 TodoNotFoundError",
      response: createTodoNotFoundErrorResponse({
        body: { actualValues: { todoId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" } },
      }),
    },
    {
      scenario: "409 TodoNotChangeableError",
      response: createTodoNotChangeableErrorResponse({
        body: {
          context: {
            todoId: "01BX5ZZKBKACTAV9WEVGEMMVRZ",
            currentStatus: "DONE",
          },
        },
      }),
    },
    {
      scenario: "403 ForbiddenError",
      response: createForbiddenErrorResponse(),
    },
    {
      scenario: "500 InternalServerError",
      response: createInternalServerErrorResponse(),
    },
  ])(
    "returns generated response union variant for $scenario",
    async ({ response }) => {
      const { client } = await setupClientTest({
        throwTodoError: response,
      });
      const requestData = createUpdateTodoRequest();
      const command = new UpdateTodoRequestCommand(requestData);

      const result = await client.send(command);

      expect(result).toEqual(response);
    }
  );
});

describe("Unknown Response Handling", () => {
  test("preserves known status response details when validation rejects the body", async () => {
    const unknownBody = { unexpectedField: "unexpected value" };
    const { client } = await setupClientTest({
      customResponses: {
        statusCode: 200,
        header: {
          "Content-Type": "application/json",
          "X-Single-Value": "invalid-success",
        },
        body: unknownBody,
      } satisfies IHttpResponse,
    });
    const requestData = createGetTodoRequest();
    const command = new GetTodoRequestCommand(requestData);

    const error = await captureUnknownResponseError(() => client.send(command));

    expect(error.statusCode).toBe(200);
    expect(error.header).toMatchObject({
      "content-type": "application/json",
      "x-single-value": "invalid-success",
    });
    expect(error.body).toEqual(unknownBody);
  });

  test("preserves unknown status response details when no generated variant matches", async () => {
    const unknownBody = { error: "Bad request with unknown structure" };
    const { client } = await setupClientTest({
      customResponses: {
        statusCode: 418,
        header: {
          "Content-Type": "application/json",
          "X-Single-Value": "unknown-status",
        },
        body: unknownBody,
      } satisfies IHttpResponse,
    });
    const requestData = createGetTodoRequest();
    const command = new GetTodoRequestCommand(requestData);

    const error = await captureUnknownResponseError(() => client.send(command));

    expect(error.statusCode).toBe(418);
    expect(error.header).toMatchObject({
      "content-type": "application/json",
      "x-single-value": "unknown-status",
    });
    expect(error.body).toEqual(unknownBody);
  });
});
