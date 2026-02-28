import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IDeleteTodoRequest,
  IDeleteTodoRequestHeader,
  IDeleteTodoRequestParam,
} from "../..";

export const createDeleteTodoRequestHeader =
  createDataFactory<IDeleteTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createDeleteTodoRequestParam =
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
    ? createDeleteTodoRequestParam(input.param)
    : createDeleteTodoRequestParam();

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
      header: createDeleteTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
