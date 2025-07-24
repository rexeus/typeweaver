import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IDeleteTodoRequestHeader,
  IDeleteTodoRequestParam,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createDeleteTodoRequestHeaders(
  input: Partial<IDeleteTodoRequestHeader> = {}
): IDeleteTodoRequestHeader {
  const defaults: IDeleteTodoRequestHeader = {
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createDeleteTodoRequestParams(
  input: Partial<IDeleteTodoRequestParam> = {}
): IDeleteTodoRequestParam {
  const defaults: IDeleteTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

type DeleteTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IDeleteTodoRequestHeader>;
  param?: Partial<IDeleteTodoRequestParam>;
};

export function createDeleteTodoRequest(
  input: DeleteTodoRequestInput = {}
): IHttpRequest {
  const param = input.param ? createDeleteTodoRequestParams(input.param) : createDeleteTodoRequestParams();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.DELETE,
    path: `/todos/${param.todoId}`,
    header: createDeleteTodoRequestHeaders(),
    param,
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createDeleteTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createDeleteTodoRequestParams(input.param);

  return createData(defaults, overrides);
}