import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import type {
  IListTodosSuccessResponse,
  IListTodosSuccessResponseHeader,
  IListTodosSuccessResponseBody,
} from "../..";
import { ListTodosSuccessResponse } from "../..";

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
): ListTodosSuccessResponse {
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
  return new ListTodosSuccessResponse(responseData);
}
