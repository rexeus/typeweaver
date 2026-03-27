import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createTodoNotChangeableErrorResponse as generatedCreateTodoNotChangeableErrorResponse } from "../../test-project/output/todo/TodoNotChangeableErrorResponse";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  ITodoNotChangeableErrorResponse,
  ITodoNotChangeableErrorResponseBody,
  ITodoNotChangeableErrorResponseHeader,
} from "../..";

type TodoNotChangeableErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoNotChangeableErrorResponseHeader>;
  body?: Partial<ITodoNotChangeableErrorResponseBody>;
};

export const createTodoNotChangeableErrorResponseHeader =
  createErrorResponseHeader<ITodoNotChangeableErrorResponseHeader>();

export const createTodoNotChangeableErrorResponseBody =
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
): ITodoNotChangeableErrorResponse {
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
      header: createTodoNotChangeableErrorResponseHeader,
    },
    input
  );
  return generatedCreateTodoNotChangeableErrorResponse(responseData);
}
