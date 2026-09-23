import assert from "node:assert";
import { UnknownResponseError } from "@rexeus/typeweaver-core";
import type { IHttpResponse } from "@rexeus/typeweaver-core";
import {
  createForbiddenErrorResponse,
  createGetTodoRequest,
  createInternalServerErrorResponse,
  createTodoNotChangeableErrorResponse,
  createTodoNotFoundErrorResponse,
  createUpdateTodoRequest,
  GetTodoRequestCommand,
  TestAssertionError,
  UpdateTodoRequestCommand,
} from "test-utils";
import { afterEach, describe, expect, test } from "vitest";
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
