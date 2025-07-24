import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import { createCreateTodoSuccessResponseHeaders } from "./CreateTodoResponseUtils";
import type {
  IListTodosSuccessResponse,
  IListTodosSuccessResponseHeader,
  IListTodosSuccessResponseBody,
} from "../..";

type ListTodosSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IListTodosSuccessResponseHeader>;
  body?: Partial<IListTodosSuccessResponseBody>;
};

export function createListTodosSuccessResponse(
  input: ListTodosSuccessResponseInput = {}
): IListTodosSuccessResponse {
  const defaults: IListTodosSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createCreateTodoSuccessResponseHeaders(),
    body: {
      results: [createGetTodoSuccessResponseBody(), createGetTodoSuccessResponseBody()],
      nextToken: faker.string.alphanumeric(32),
    },
  };

  const overrides: Partial<IListTodosSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createCreateTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined) {
    overrides.body = createData(defaults.body, input.body);
  }

  return createData(defaults, overrides);
}
