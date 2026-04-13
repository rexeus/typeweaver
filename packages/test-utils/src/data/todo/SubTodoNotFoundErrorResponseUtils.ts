import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createSubTodoNotFoundErrorResponse as generatedCreateSubTodoNotFoundErrorResponse } from "../../test-project/output/responses/SubTodoNotFoundErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  ISubTodoNotFoundErrorResponse,
  ISubTodoNotFoundErrorResponseBody,
  ISubTodoNotFoundErrorResponseHeader,
} from "../../index.js";

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
