import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "./createData";
import type {
  IQuerySubTodoRequestHeader,
  IQuerySubTodoRequestParam,
  IQuerySubTodoRequestQuery,
  IQuerySubTodoRequestBody,
} from "..";

export function createQuerySubTodoRequestHeaders(
  input: Partial<IQuerySubTodoRequestHeader> = {}
): IQuerySubTodoRequestHeader {
  const defaults: IQuerySubTodoRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${faker.string.alphanumeric(20)}`,
  };

  return createData(defaults, input);
}

export function createQuerySubTodoRequestParams(
  input: Partial<IQuerySubTodoRequestParam> = {}
): IQuerySubTodoRequestParam {
  const defaults: IQuerySubTodoRequestParam = {
    todoId: faker.string.fromCharacters("0123456789ABCDEFGHJKMNPQRSTVWXYZ", 26),
  };

  return createData(defaults, input);
}

export function createQuerySubTodoRequestQuery(
  input: Partial<IQuerySubTodoRequestQuery> = {}
): IQuerySubTodoRequestQuery {
  const defaults: IQuerySubTodoRequestQuery = {
    limit: faker.number.int({ min: 1, max: 100 }).toString(),
    sortBy: faker.helpers.arrayElement(["title", "dueDate", "priority", "createdAt", "modifiedAt"]),
    sortOrder: faker.helpers.arrayElement(["asc", "desc"]),
    format: faker.helpers.arrayElement(["summary", "detailed"]),
  };

  return createData(defaults, input);
}

export function createQuerySubTodoRequestBody(
  input: Partial<IQuerySubTodoRequestBody> = {}
): IQuerySubTodoRequestBody {
  const defaults: IQuerySubTodoRequestBody = {
    searchText: faker.lorem.words(3),
    status: faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"]),
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"]),
    dateRange: {
      from: faker.date.past().toISOString().split('T')[0],
      to: faker.date.future().toISOString().split('T')[0],
    },
    tags: [faker.lorem.word(), faker.lorem.word()],
  };

  return createData(defaults, input);
}

type CreateQuerySubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IQuerySubTodoRequestHeader>;
  param?: Partial<IQuerySubTodoRequestParam>;
  query?: Partial<IQuerySubTodoRequestQuery>;
  body?: Partial<IQuerySubTodoRequestBody>;
};

export function createQuerySubTodoRequest(
  input: CreateQuerySubTodoRequestInput = {}
): IHttpRequest {
  const param = input.param ? createQuerySubTodoRequestParams(input.param) : createQuerySubTodoRequestParams();
  const header = input.header ? createQuerySubTodoRequestHeaders(input.header) : createQuerySubTodoRequestHeaders();
  const query = input.query ? createQuerySubTodoRequestQuery(input.query) : createQuerySubTodoRequestQuery();
  const body = input.body ? createQuerySubTodoRequestBody(input.body) : createQuerySubTodoRequestBody();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.POST,
    path: `/todos/${param.todoId}/subtodos/query`,
    header,
    param,
    query,
    body,
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;

  return createData(defaults, overrides);
}