import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type {
  IHeadTodoRequest,
  IHeadTodoRequestHeader,
  IHeadTodoRequestParam,
} from "../..";

export function createHeadTodoRequestHeaders(
  input: Partial<IHeadTodoRequestHeader> = {}
): IHeadTodoRequestHeader {
  const defaults: IHeadTodoRequestHeader = {
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createHeadTodoRequestParams(
  input: Partial<IHeadTodoRequestParam> = {}
): IHeadTodoRequestParam {
  const defaults: IHeadTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

type CreateHeadTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IHeadTodoRequestHeader>;
  param?: Partial<IHeadTodoRequestParam>;
};

export function createHeadTodoRequest(
  input: CreateHeadTodoRequestInput = {}
): IHeadTodoRequest {
  const param = input.param
    ? createHeadTodoRequestParams(input.param)
    : createHeadTodoRequestParams();

  const header = input.header
    ? createHeadTodoRequestHeaders(input.header)
    : createHeadTodoRequestHeaders();

  const defaults: IHeadTodoRequest = {
    method: HttpMethod.HEAD,
    path: `/todos/${param.todoId}`,
    header,
    param,
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;

  return createData(defaults, overrides as IHeadTodoRequest);
}