import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  ITodoStatusTransitionInvalidErrorResponse,
  ITodoStatusTransitionInvalidErrorResponseHeader,
  ITodoStatusTransitionInvalidErrorResponseBody,
} from "../..";
import { TodoStatusTransitionInvalidErrorResponse } from "../..";
type TodoStatusTransitionInvalidErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoStatusTransitionInvalidErrorResponseHeader>;
  body?: Partial<ITodoStatusTransitionInvalidErrorResponseBody>;
};

const createTodoStatusTransitionInvalidErrorResponseHeaders =
  createErrorResponseHeaders<ITodoStatusTransitionInvalidErrorResponseHeader>();

const createTodoStatusTransitionInvalidErrorResponseBody =
  createDataFactory<ITodoStatusTransitionInvalidErrorResponseBody>(() => ({
    message: "Todo status transition is conflicting with current status",
    code: "TODO_STATUS_TRANSITION_INVALID_ERROR",
    context: {
      todoId: faker.string.ulid(),
      currentStatus: "DONE",
    },
    actualValues: {
      requestedStatus: "TODO",
    },
    expectedValues: {
      allowedStatuses: ["TODO", "IN_PROGRESS"],
    },
  }));

export function createTodoStatusTransitionInvalidErrorResponse(
  input: TodoStatusTransitionInvalidErrorResponseInput = {}
): TodoStatusTransitionInvalidErrorResponse {
  const responseData = createResponse<
    ITodoStatusTransitionInvalidErrorResponse,
    ITodoStatusTransitionInvalidErrorResponseBody,
    ITodoStatusTransitionInvalidErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CONFLICT,
    },
    {
      body: createTodoStatusTransitionInvalidErrorResponseBody,
      header: createTodoStatusTransitionInvalidErrorResponseHeaders,
    },
    input
  );
  return new TodoStatusTransitionInvalidErrorResponse(responseData);
}
