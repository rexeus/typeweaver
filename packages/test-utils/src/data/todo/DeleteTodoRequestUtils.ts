import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IDeleteTodoRequest,
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
  path?: string;
  header?: Partial<IDeleteTodoRequestHeader>;
  param?: Partial<IDeleteTodoRequestParam>;
};

export function createDeleteTodoRequest(
  input: DeleteTodoRequestInput = {}
): IDeleteTodoRequest {
  const param = input.param ? createDeleteTodoRequestParams(input.param) : createDeleteTodoRequestParams();
  
  const defaults: IDeleteTodoRequest = {
    method: HttpMethod.DELETE,
    path: `/todos/${param.todoId}`,
    header: createDeleteTodoRequestHeaders(),
    param,
  };

  const overrides: Partial<IDeleteTodoRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createDeleteTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createDeleteTodoRequestParams(input.param);

  return createData(defaults, overrides as IDeleteTodoRequest);
}