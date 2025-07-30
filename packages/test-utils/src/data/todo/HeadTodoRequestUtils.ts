import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";
import type {
  IHeadTodoRequest,
  IHeadTodoRequestHeader,
  IHeadTodoRequestParam,
} from "../..";

export const createHeadTodoRequestHeaders =
  createDataFactory<IHeadTodoRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createHeadTodoRequestParams =
  createDataFactory<IHeadTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

type CreateHeadTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IHeadTodoRequestHeader>;
  param?: Partial<IHeadTodoRequestParam>;
};

export function createHeadTodoRequest(
  input: CreateHeadTodoRequestInput = {}
): IHeadTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createHeadTodoRequestParams(input.param)
    : createHeadTodoRequestParams();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}`;

  return createRequest<
    IHeadTodoRequest,
    never,
    IHeadTodoRequestHeader,
    IHeadTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.HEAD,
      path: dynamicPath,
    },
    {
      header: createHeadTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
