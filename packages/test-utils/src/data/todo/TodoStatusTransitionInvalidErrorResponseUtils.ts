import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  ITodoStatusTransitionInvalidErrorResponse,
  ITodoStatusTransitionInvalidErrorResponseHeader,
  ITodoStatusTransitionInvalidErrorResponseBody,
} from "../..";
type TodoStatusTransitionInvalidErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoStatusTransitionInvalidErrorResponseHeader>;
  body?: Partial<ITodoStatusTransitionInvalidErrorResponseBody>;
};

export function createTodoStatusTransitionInvalidErrorResponse(
  input: TodoStatusTransitionInvalidErrorResponseInput = {}
): ITodoStatusTransitionInvalidErrorResponse {
  const defaults: ITodoStatusTransitionInvalidErrorResponse = {
    statusCode: HttpStatusCode.CONFLICT,
    header:
      createErrorResponseHeaders<ITodoStatusTransitionInvalidErrorResponseHeader>(),
    body: {
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
    },
  };

  const overrides: Partial<ITodoStatusTransitionInvalidErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
