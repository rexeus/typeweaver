import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateTodoStatusRequestHeader,
  IUpdateTodoStatusRequestParam,
  IUpdateTodoStatusRequestBody,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createUpdateTodoStatusRequestHeaders(
  input: Partial<IUpdateTodoStatusRequestHeader> = {}
): IUpdateTodoStatusRequestHeader {
  const defaults: IUpdateTodoStatusRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createUpdateTodoStatusRequestParams(
  input: Partial<IUpdateTodoStatusRequestParam> = {}
): IUpdateTodoStatusRequestParam {
  const defaults: IUpdateTodoStatusRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

export function createUpdateTodoStatusRequestBody(
  input: Partial<IUpdateTodoStatusRequestBody> = {}
): IUpdateTodoStatusRequestBody {
  const defaults: IUpdateTodoStatusRequestBody = {
    value: faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const),
  };

  return createData(defaults, input);
}

type UpdateTodoStatusRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IUpdateTodoStatusRequestHeader>;
  param?: Partial<IUpdateTodoStatusRequestParam>;
  body?: Partial<IUpdateTodoStatusRequestBody>;
};

export function createUpdateTodoStatusRequest(
  input: UpdateTodoStatusRequestInput = {}
): IHttpRequest {
  const param = input.param ? createUpdateTodoStatusRequestParams(input.param) : createUpdateTodoStatusRequestParams();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.PUT,
    path: `/todos/${param.todoId}/status`,
    header: createUpdateTodoStatusRequestHeaders(),
    param,
    body: createUpdateTodoStatusRequestBody(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createUpdateTodoStatusRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createUpdateTodoStatusRequestParams(input.param);
  if (input.body !== undefined)
    overrides.body = createUpdateTodoStatusRequestBody(input.body);

  return createData(defaults, overrides);
}