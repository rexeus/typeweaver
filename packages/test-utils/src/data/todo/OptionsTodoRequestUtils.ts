import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type {
  IOptionsTodoRequest,
  IOptionsTodoRequestHeader,
  IOptionsTodoRequestParam,
} from "../..";

export function createOptionsTodoRequestHeaders(
  input: Partial<IOptionsTodoRequestHeader> = {}
): IOptionsTodoRequestHeader {
  const defaults: IOptionsTodoRequestHeader = {
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createOptionsTodoRequestParams(
  input: Partial<IOptionsTodoRequestParam> = {}
): IOptionsTodoRequestParam {
  const defaults: IOptionsTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

type CreateOptionsTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IOptionsTodoRequestHeader>;
  param?: Partial<IOptionsTodoRequestParam>;
};

export function createOptionsTodoRequest(
  input: CreateOptionsTodoRequestInput = {}
): IOptionsTodoRequest {
  const param = input.param
    ? createOptionsTodoRequestParams(input.param)
    : createOptionsTodoRequestParams();

  const header = input.header
    ? createOptionsTodoRequestHeaders(input.header)
    : createOptionsTodoRequestHeaders();

  const defaults: IOptionsTodoRequest = {
    method: HttpMethod.OPTIONS,
    path: `/todos/${param.todoId}`,
    header,
    param,
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;

  return createData(defaults, overrides as IOptionsTodoRequest);
}