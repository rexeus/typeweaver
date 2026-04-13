import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createTodoStatusTransitionInvalidErrorResponse as generatedCreateTodoStatusTransitionInvalidErrorResponse } from "../../test-project/output/responses/TodoStatusTransitionInvalidErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  ITodoStatusTransitionInvalidErrorResponse,
  ITodoStatusTransitionInvalidErrorResponseBody,
  ITodoStatusTransitionInvalidErrorResponseHeader,
} from "../../index.js";

type TodoStatusTransitionInvalidErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoStatusTransitionInvalidErrorResponseHeader>;
  body?: Partial<ITodoStatusTransitionInvalidErrorResponseBody>;
};

export const createTodoStatusTransitionInvalidErrorResponseHeader =
  createErrorResponseHeader<ITodoStatusTransitionInvalidErrorResponseHeader>();

export const createTodoStatusTransitionInvalidErrorResponseBody =
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
): ITodoStatusTransitionInvalidErrorResponse {
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
      header: createTodoStatusTransitionInvalidErrorResponseHeader,
    },
    input
  );
  return generatedCreateTodoStatusTransitionInvalidErrorResponse(responseData);
}
