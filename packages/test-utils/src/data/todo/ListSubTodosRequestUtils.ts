import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IListSubTodosRequestHeader,
  IListSubTodosRequestParam,
  IListSubTodosRequestQuery,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createListSubTodosRequestHeaders(
  input: Partial<IListSubTodosRequestHeader> = {}
): IListSubTodosRequestHeader {
  const defaults: IListSubTodosRequestHeader = {
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createListSubTodosRequestParams(
  input: Partial<IListSubTodosRequestParam> = {}
): IListSubTodosRequestParam {
  const defaults: IListSubTodosRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

export function createListSubTodosRequestQuery(
  input: Partial<IListSubTodosRequestQuery> = {}
): IListSubTodosRequestQuery {
  const defaults: IListSubTodosRequestQuery = {
    limit: faker.datatype.boolean() ? faker.number.int({ min: 1, max: 100 }).toString() : undefined,
    nextToken: faker.datatype.boolean() ? faker.string.alphanumeric(32) : undefined,
    sortBy: faker.datatype.boolean() ? faker.helpers.arrayElement(["title", "dueDate", "priority", "createdAt", "modifiedAt"]) : undefined,
    sortOrder: faker.datatype.boolean() ? faker.helpers.arrayElement(["asc", "desc"]) : undefined,
  };

  return createData(defaults, input);
}

type ListSubTodosRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IListSubTodosRequestHeader>;
  param?: Partial<IListSubTodosRequestParam>;
  query?: Partial<IListSubTodosRequestQuery>;
};

export function createListSubTodosRequest(
  input: ListSubTodosRequestInput = {}
): IHttpRequest {
  const param = input.param ? createListSubTodosRequestParams(input.param) : createListSubTodosRequestParams();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.GET,
    path: `/todos/${param.todoId}/subtodos`,
    header: createListSubTodosRequestHeaders(),
    param,
    query: createListSubTodosRequestQuery(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createListSubTodosRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createListSubTodosRequestParams(input.param);
  if (input.query !== undefined)
    overrides.query = createListSubTodosRequestQuery(input.query);

  return createData(defaults, overrides);
}