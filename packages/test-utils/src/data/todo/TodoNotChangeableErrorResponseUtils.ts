import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  ITodoNotChangeableErrorResponse,
  ITodoNotChangeableErrorResponseHeader,
  ITodoNotChangeableErrorResponseBody,
} from "../..";
import { TodoNotChangeableErrorResponse } from "../..";

type TodoNotChangeableErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoNotChangeableErrorResponseHeader>;
  body?: Partial<ITodoNotChangeableErrorResponseBody>;
};

const createTodoNotChangeableErrorResponseHeaders =
  createErrorResponseHeaders<ITodoNotChangeableErrorResponseHeader>();

const createTodoNotChangeableErrorResponseBody =
  createDataFactory<ITodoNotChangeableErrorResponseBody>(() => ({
    message: "Todo in current status cannot be changed",
    code: "TODO_NOT_CHANGEABLE_ERROR",
    context: {
      todoId: faker.string.ulid(),
      currentStatus: "DONE",
    },
    expectedValues: {
      allowedStatuses: ["TODO", "IN_PROGRESS"],
    },
  }));

export function createTodoNotChangeableErrorResponse(
  input: TodoNotChangeableErrorResponseInput = {}
): TodoNotChangeableErrorResponse {
  const responseData = createResponse<
    ITodoNotChangeableErrorResponse,
    ITodoNotChangeableErrorResponseBody,
    ITodoNotChangeableErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CONFLICT,
    },
    {
      body: createTodoNotChangeableErrorResponseBody,
      header: createTodoNotChangeableErrorResponseHeaders,
    },
    input
  );
  return new TodoNotChangeableErrorResponse(responseData);
}
