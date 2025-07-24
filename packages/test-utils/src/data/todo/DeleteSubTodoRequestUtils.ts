import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IDeleteSubTodoRequestHeader,
  IDeleteSubTodoRequestParam,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createDeleteSubTodoRequestHeaders(
  input: Partial<IDeleteSubTodoRequestHeader> = {}
): IDeleteSubTodoRequestHeader {
  const defaults: IDeleteSubTodoRequestHeader = {
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createDeleteSubTodoRequestParams(
  input: Partial<IDeleteSubTodoRequestParam> = {}
): IDeleteSubTodoRequestParam {
  const defaults: IDeleteSubTodoRequestParam = {
    todoId: faker.string.ulid(),
    subtodoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

type DeleteSubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IDeleteSubTodoRequestHeader>;
  param?: Partial<IDeleteSubTodoRequestParam>;
};

export function createDeleteSubTodoRequest(
  input: DeleteSubTodoRequestInput = {}
): IHttpRequest {
  const param = input.param ? createDeleteSubTodoRequestParams(input.param) : createDeleteSubTodoRequestParams();
  
  const defaults: IHttpRequest = {
    method: HttpMethod.DELETE,
    path: `/todos/${param.todoId}/subtodos/${param.subtodoId}`,
    header: createDeleteSubTodoRequestHeaders(),
    param,
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createDeleteSubTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createDeleteSubTodoRequestParams(input.param);

  return createData(defaults, overrides);
}