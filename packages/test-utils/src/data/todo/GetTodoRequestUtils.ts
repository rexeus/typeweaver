import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";
import type {
  IGetTodoRequest,
  IGetTodoRequestHeader,
  IGetTodoRequestParam,
} from "../..";

export const createGetTodoRequestHeaders =
  createDataFactory<IGetTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createGetTodoRequestParams =
  createDataFactory<IGetTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

type CreateGetTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IGetTodoRequestHeader>;
  param?: Partial<IGetTodoRequestParam>;
};

export function createGetTodoRequest(
  input: CreateGetTodoRequestInput = {}
): IGetTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createGetTodoRequestParams(input.param)
    : createGetTodoRequestParams();

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
      header: createGetTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
