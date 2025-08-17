import { faker } from "@faker-js/faker";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { TodoNotFoundErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  ITodoNotFoundErrorResponse,
  ITodoNotFoundErrorResponseBody,
  ITodoNotFoundErrorResponseHeader,
} from "../..";

type TodoNotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITodoNotFoundErrorResponseHeader>;
  body?: Partial<ITodoNotFoundErrorResponseBody>;
};

export const createTodoNotFoundErrorResponseHeader =
  createErrorResponseHeader<ITodoNotFoundErrorResponseHeader>();

export const createTodoNotFoundErrorResponseBody =
  createDataFactory<ITodoNotFoundErrorResponseBody>(() => ({
    message: "Todo not found",
    code: "TODO_NOT_FOUND_ERROR",
    actualValues: {
      todoId: faker.string.ulid(),
    },
  }));

export function createTodoNotFoundErrorResponse(
  input: TodoNotFoundErrorResponseInput = {}
): TodoNotFoundErrorResponse {
  const responseData = createResponse<
    ITodoNotFoundErrorResponse,
    ITodoNotFoundErrorResponseBody,
    ITodoNotFoundErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.NOT_FOUND,
    },
    {
      body: createTodoNotFoundErrorResponseBody,
      header: createTodoNotFoundErrorResponseHeader,
    },
    input
  );
  return new TodoNotFoundErrorResponse(responseData);
}
