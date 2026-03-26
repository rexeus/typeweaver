import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import { createSubTodoNotFoundErrorResponse as generatedCreateSubTodoNotFoundErrorResponse } from "../../test-project/output/todo/SubTodoNotFoundErrorResponse";
import type {
  ISubTodoNotFoundErrorResponse,
  ISubTodoNotFoundErrorResponseBody,
  ISubTodoNotFoundErrorResponseHeader,
} from "../..";

type SubTodoNotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISubTodoNotFoundErrorResponseHeader>;
  body?: Partial<ISubTodoNotFoundErrorResponseBody>;
};

export const createSubTodoNotFoundErrorResponseHeader =
  createErrorResponseHeader<ISubTodoNotFoundErrorResponseHeader>();

export const createSubTodoNotFoundErrorResponseBody =
  createDataFactory<ISubTodoNotFoundErrorResponseBody>(() => ({
    message: "SubTodo not found",
    code: "SUBTODO_NOT_FOUND_ERROR",
    context: {
      todoId: faker.string.ulid(),
    },
    actualValues: {
      subtodoId: faker.string.ulid(),
    },
  }));

export function createSubTodoNotFoundErrorResponse(
  input: SubTodoNotFoundErrorResponseInput = {}
): ISubTodoNotFoundErrorResponse {
  const responseData = createResponse<
    ISubTodoNotFoundErrorResponse,
    ISubTodoNotFoundErrorResponseBody,
    ISubTodoNotFoundErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.NOT_FOUND,
    },
    {
      body: createSubTodoNotFoundErrorResponseBody,
      header: createSubTodoNotFoundErrorResponseHeader,
    },
    input
  );
  return generatedCreateSubTodoNotFoundErrorResponse(responseData);
}
