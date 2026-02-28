import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IGetTodoRequest,
  IGetTodoRequestHeader,
  IGetTodoRequestParam,
} from "../..";

export const createGetTodoRequestHeader =
  createDataFactory<IGetTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createGetTodoRequestParam =
  createDataFactory<IGetTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

type GetTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IGetTodoRequestHeader>;
  param?: Partial<IGetTodoRequestParam>;
};

export function createGetTodoRequest(
  input: GetTodoRequestInput = {}
): IGetTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createGetTodoRequestParam(input.param)
    : createGetTodoRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}`;

  return createRequest<
    IGetTodoRequest,
    never,
    IGetTodoRequestHeader,
    IGetTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.GET,
      path: dynamicPath,
    },
    {
      header: createGetTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
