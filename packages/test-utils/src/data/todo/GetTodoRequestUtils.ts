import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type {
  IGetTodoRequestHeader,
  IGetTodoRequestParam,
} from "../..";

export function createGetTodoRequestHeaders(
  input: Partial<IGetTodoRequestHeader> = {}
): IGetTodoRequestHeader {
  const defaults: IGetTodoRequestHeader = {
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createGetTodoRequestParams(
  input: Partial<IGetTodoRequestParam> = {}
): IGetTodoRequestParam {
  const defaults: IGetTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

type CreateGetTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IGetTodoRequestHeader>;
  param?: Partial<IGetTodoRequestParam>;
};

export function createGetTodoRequest(
  input: CreateGetTodoRequestInput = {}
): IHttpRequest {
  const param = input.param ? createGetTodoRequestParams(input.param) : createGetTodoRequestParams();
  
  const header = input.header ? createGetTodoRequestHeaders(input.header) : createGetTodoRequestHeaders();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.GET,
    path: `/todos/${param.todoId}`,
    header,
    param,
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;

  return createData(defaults, overrides);
}