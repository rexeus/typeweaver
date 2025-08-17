import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IDeleteSubTodoRequest,
  IDeleteSubTodoRequestHeader,
  IDeleteSubTodoRequestParam,
} from "../..";

export const createDeleteSubTodoRequestHeader =
  createDataFactory<IDeleteSubTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createDeleteSubTodoRequestParam =
  createDataFactory<IDeleteSubTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
    subtodoId: faker.string.ulid(),
  }));

type DeleteSubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IDeleteSubTodoRequestHeader>;
  param?: Partial<IDeleteSubTodoRequestParam>;
};

export function createDeleteSubTodoRequest(
  input: DeleteSubTodoRequestInput = {}
): IDeleteSubTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createDeleteSubTodoRequestParam(input.param)
    : createDeleteSubTodoRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath =
    input.path ?? `/todos/${param.todoId}/subtodos/${param.subtodoId}`;

  return createRequest<
    IDeleteSubTodoRequest,
    never,
    IDeleteSubTodoRequestHeader,
    IDeleteSubTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.DELETE,
      path: dynamicPath,
    },
    {
      header: createDeleteSubTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
