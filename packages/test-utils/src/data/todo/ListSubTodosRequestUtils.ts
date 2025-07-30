import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IListSubTodosRequest } from "../..";
import { faker } from "@faker-js/faker";
import type {
  IListSubTodosRequestHeader,
  IListSubTodosRequestParam,
  IListSubTodosRequestQuery,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createListSubTodosRequestHeaders =
  createDataFactory<IListSubTodosRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createListSubTodosRequestParams =
  createDataFactory<IListSubTodosRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createListSubTodosRequestQuery =
  createDataFactory<IListSubTodosRequestQuery>(() => ({
    limit: faker.helpers.arrayElement([
      faker.number.int({ min: 1, max: 100 }).toString(),
      undefined,
    ]),
    nextToken: faker.helpers.arrayElement([
      faker.string.alphanumeric(32),
      undefined,
    ]),
    sortBy: faker.helpers.arrayElement([
      faker.helpers.arrayElement([
        "title",
        "dueDate",
        "priority",
        "createdAt",
        "modifiedAt",
      ]),
      undefined,
    ]),
    sortOrder: faker.helpers.arrayElement([
      faker.helpers.arrayElement(["asc", "desc"]),
      undefined,
    ]),
  }));

type ListSubTodosRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IListSubTodosRequestHeader>;
  param?: Partial<IListSubTodosRequestParam>;
  query?: Partial<IListSubTodosRequestQuery>;
};

export function createListSubTodosRequest(
  input: ListSubTodosRequestInput = {}
): IListSubTodosRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createListSubTodosRequestParams(input.param)
    : createListSubTodosRequestParams();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}/subtodos`;

  return createRequest<
    IListSubTodosRequest,
    never,
    IListSubTodosRequestHeader,
    IListSubTodosRequestParam,
    IListSubTodosRequestQuery
  >(
    {
      method: HttpMethod.GET,
      path: dynamicPath,
    },
    {
      header: createListSubTodosRequestHeaders,
      param: () => param, // Use pre-generated param
      query: createListSubTodosRequestQuery,
    },
    input
  );
}
