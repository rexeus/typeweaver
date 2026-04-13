import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createTodoNotFoundErrorResponse as generatedCreateTodoNotFoundErrorResponse } from "../../test-project/output/responses/TodoNotFoundErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  ITodoNotFoundErrorResponse,
  ITodoNotFoundErrorResponseBody,
  ITodoNotFoundErrorResponseHeader,
} from "../../index.js";

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
): ITodoNotFoundErrorResponse {
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
  return generatedCreateTodoNotFoundErrorResponse(responseData);
}
