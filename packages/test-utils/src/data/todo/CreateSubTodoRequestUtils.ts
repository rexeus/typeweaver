import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ICreateSubTodoRequestHeader,
  ICreateSubTodoRequestParam,
  ICreateSubTodoRequestBody,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createCreateSubTodoRequestHeaders(
  input: Partial<ICreateSubTodoRequestHeader> = {}
): ICreateSubTodoRequestHeader {
  const defaults: ICreateSubTodoRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createCreateSubTodoRequestParams(
  input: Partial<ICreateSubTodoRequestParam> = {}
): ICreateSubTodoRequestParam {
  const defaults: ICreateSubTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

export function createCreateSubTodoRequestBody(
  input: Partial<ICreateSubTodoRequestBody> = {}
): ICreateSubTodoRequestBody {
  const defaults: ICreateSubTodoRequestBody = {
    title: faker.lorem.sentence(),
    description: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
    dueDate: faker.datatype.boolean() ? faker.date.future().toISOString() : undefined,
    tags: faker.datatype.boolean() ? [faker.lorem.word(), faker.lorem.word()] : undefined,
    priority: faker.datatype.boolean() ? faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const) : undefined,
  };

  return createData(defaults, input);
}

type CreateSubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<ICreateSubTodoRequestHeader>;
  param?: Partial<ICreateSubTodoRequestParam>;
  body?: Partial<ICreateSubTodoRequestBody>;
};

export function createCreateSubTodoRequest(
  input: CreateSubTodoRequestInput = {}
): IHttpRequest {
  const param = input.param ? createCreateSubTodoRequestParams(input.param) : createCreateSubTodoRequestParams();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.POST,
    path: `/todos/${param.todoId}/subtodos`,
    header: createCreateSubTodoRequestHeaders(),
    param,
    body: createCreateSubTodoRequestBody(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createCreateSubTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createCreateSubTodoRequestParams(input.param);
  if (input.body !== undefined)
    overrides.body = createCreateSubTodoRequestBody(input.body);

  return createData(defaults, overrides);
}