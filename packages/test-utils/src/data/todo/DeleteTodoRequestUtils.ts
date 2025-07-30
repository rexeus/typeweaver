import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IDeleteTodoRequest,
  IDeleteTodoRequestHeader,
  IDeleteTodoRequestParam,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createDeleteTodoRequestHeaders =
  createDataFactory<IDeleteTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createDeleteTodoRequestParams =
  createDataFactory<IDeleteTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

type DeleteTodoRequestInput = {
  path?: string;
  header?: Partial<IDeleteTodoRequestHeader>;
  param?: Partial<IDeleteTodoRequestParam>;
};

export function createDeleteTodoRequest(
  input: DeleteTodoRequestInput = {}
): IDeleteTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createDeleteTodoRequestParams(input.param)
    : createDeleteTodoRequestParams();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}`;

  return createRequest<
    IDeleteTodoRequest,
    never,
    IDeleteTodoRequestHeader,
    IDeleteTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.DELETE,
      path: dynamicPath,
    },
    {
      header: createDeleteTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
