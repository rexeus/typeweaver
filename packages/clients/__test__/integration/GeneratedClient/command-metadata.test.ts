import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  AccessTokenRequestCommand,
  createAccessTokenRequest,
  createCreateTodoRequest,
  createGetTodoRequest,
  CreateTodoRequestCommand,
  createUpdateTodoRequest,
  GetTodoRequestCommand,
  UpdateTodoRequestCommand,
} from "test-utils";
import { afterEach, describe, expect, test } from "vitest";
import { runClientCleanup } from "./clientSetup.js";

afterEach(async () => {
  await runClientCleanup();
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
