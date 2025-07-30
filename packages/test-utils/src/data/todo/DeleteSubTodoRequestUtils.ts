import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IDeleteSubTodoRequest } from "../..";
import { faker } from "@faker-js/faker";
import type {
  IDeleteSubTodoRequestHeader,
  IDeleteSubTodoRequestParam,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createDeleteSubTodoRequestHeaders =
  createDataFactory<IDeleteSubTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createDeleteSubTodoRequestParams =
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
    ? createDeleteSubTodoRequestParams(input.param)
    : createDeleteSubTodoRequestParams();

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
      header: createDeleteSubTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
