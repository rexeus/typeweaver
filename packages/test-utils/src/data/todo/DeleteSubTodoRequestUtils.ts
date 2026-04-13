import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory.js";
import { createJwtToken } from "../createJwtToken.js";
import { createRequest } from "../createRequest.js";
import type {
  IDeleteSubTodoRequest,
  IDeleteSubTodoRequestHeader,
  IDeleteSubTodoRequestParam,
} from "../../index.js";

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
