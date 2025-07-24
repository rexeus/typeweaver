import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateSubTodoRequestHeader,
  IUpdateSubTodoRequestParam,
  IUpdateSubTodoRequestBody,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createUpdateSubTodoRequestHeaders(
  input: Partial<IUpdateSubTodoRequestHeader> = {}
): IUpdateSubTodoRequestHeader {
  const defaults: IUpdateSubTodoRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createUpdateSubTodoRequestParams(
  input: Partial<IUpdateSubTodoRequestParam> = {}
): IUpdateSubTodoRequestParam {
  const defaults: IUpdateSubTodoRequestParam = {
    todoId: faker.string.ulid(),
    subtodoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

export function createUpdateSubTodoRequestBody(
  input: Partial<IUpdateSubTodoRequestBody> = {}
): IUpdateSubTodoRequestBody {
  const defaults: IUpdateSubTodoRequestBody = {
    title: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    description: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
    status: faker.datatype.boolean() ? faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) : undefined,
    dueDate: faker.datatype.boolean() ? faker.date.future().toISOString() : undefined,
    tags: faker.datatype.boolean() ? [faker.lorem.word(), faker.lorem.word()] : undefined,
    priority: faker.datatype.boolean() ? faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const) : undefined,
  };

  return createData(defaults, input);
}

type UpdateSubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IUpdateSubTodoRequestHeader>;
  param?: Partial<IUpdateSubTodoRequestParam>;
  body?: Partial<IUpdateSubTodoRequestBody>;
};

export function createUpdateSubTodoRequest(
  input: UpdateSubTodoRequestInput = {}
): IHttpRequest {
  const param = input.param ? createUpdateSubTodoRequestParams(input.param) : createUpdateSubTodoRequestParams();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.PUT,
    path: `/todos/${param.todoId}/subtodos/${param.subtodoId}`,
    header: createUpdateSubTodoRequestHeaders(),
    param,
    body: createUpdateSubTodoRequestBody(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createUpdateSubTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createUpdateSubTodoRequestParams(input.param);
  if (input.body !== undefined)
    overrides.body = createUpdateSubTodoRequestBody(input.body);

  return createData(defaults, overrides);
}