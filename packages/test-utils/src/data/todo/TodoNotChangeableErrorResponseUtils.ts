import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
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

export function createTodoNotChangeableErrorResponse(
  input: TodoNotChangeableErrorResponseInput = {}
): TodoNotChangeableErrorResponse {
  const defaults: ITodoNotChangeableErrorResponse = {
    statusCode: HttpStatusCode.CONFLICT,
    header: createErrorResponseHeaders<ITodoNotChangeableErrorResponseHeader>(),
    body: {
      message: "Todo in current status cannot be changed",
      code: "TODO_NOT_CHANGEABLE_ERROR",
      context: {
        todoId: faker.string.ulid(),
        currentStatus: "DONE",
      },
      expectedValues: {
        allowedStatuses: ["TODO", "IN_PROGRESS"],
      },
    },
  };

  const overrides: Partial<ITodoNotChangeableErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  const responseData = createData(defaults, overrides);
  return new TodoNotChangeableErrorResponse(responseData);
}
