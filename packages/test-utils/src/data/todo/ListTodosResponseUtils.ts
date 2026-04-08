import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createListTodosSuccessResponse as generatedCreateListTodosSuccessResponse } from "../../test-project/output/responses/ListTodosSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils.js";
import type {
  IListTodosSuccessResponse,
  IListTodosSuccessResponseBody,
  IListTodosSuccessResponseHeader,
} from "../../index.js";

type ListTodosSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IListTodosSuccessResponseHeader>;
  body?: Partial<IListTodosSuccessResponseBody>;
};

export const createListTodosSuccessResponseHeader =
  createDataFactory<IListTodosSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
    "X-Total-Count": faker.number.int({ min: 1, max: 100 }).toString(),
  }));

export const createListTodosSuccessResponseBody =
  createDataFactory<IListTodosSuccessResponseBody>(() => ({
    results: [
      createGetTodoSuccessResponseBody(),
      createGetTodoSuccessResponseBody(),
    ],
    nextToken: faker.string.alphanumeric(32),
  }));

export function createListTodosSuccessResponse(
  input: ListTodosSuccessResponseInput = {}
): IListTodosSuccessResponse {
  const responseData = createResponse<
    IListTodosSuccessResponse,
    IListTodosSuccessResponseBody,
    IListTodosSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createListTodosSuccessResponseBody,
      header: createListTodosSuccessResponseHeader,
    },
    input
  );
  return generatedCreateListTodosSuccessResponse(responseData);
}
