import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  ITodoNotFoundErrorResponse,
  ITodoNotFoundErrorResponseHeader,
  ITodoNotFoundErrorResponseBody,
} from "../..";
import { TodoNotFoundErrorResponse } from "../..";

type TodoNotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoNotFoundErrorResponseHeader>;
  body?: Partial<ITodoNotFoundErrorResponseBody>;
};

export function createTodoNotFoundErrorResponse(
  input: TodoNotFoundErrorResponseInput = {}
): TodoNotFoundErrorResponse {
  const defaults: ITodoNotFoundErrorResponse = {
    statusCode: HttpStatusCode.NOT_FOUND,
    header: createErrorResponseHeaders<ITodoNotFoundErrorResponseHeader>(),
    body: {
      message: "Todo not found",
      code: "TODO_NOT_FOUND_ERROR",
      actualValues: {
        todoId: faker.string.ulid(),
      },
    },
  };

  const overrides: Partial<ITodoNotFoundErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined) overrides.body = createData(defaults.body, input.body);

  const responseData = createData(defaults, overrides);
  return new TodoNotFoundErrorResponse(responseData);
}