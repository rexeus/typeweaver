import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateTodoRequest,
  IUpdateTodoRequestHeader,
  IUpdateTodoRequestParam,
  IUpdateTodoRequestBody,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createUpdateTodoRequestHeaders =
  createDataFactory<IUpdateTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createUpdateTodoRequestParams =
  createDataFactory<IUpdateTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createUpdateTodoRequestBody =
  createDataFactory<IUpdateTodoRequestBody>(() => ({
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
  }));

type UpdateTodoRequestInput = {
  path?: string;
  header?: Partial<IUpdateTodoRequestHeader>;
  param?: Partial<IUpdateTodoRequestParam>;
  body?: Partial<IUpdateTodoRequestBody>;
};

export function createUpdateTodoRequest(
  input: UpdateTodoRequestInput = {}
): IUpdateTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createUpdateTodoRequestParams(input.param)
    : createUpdateTodoRequestParams();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}`;

  return createRequest<
    IUpdateTodoRequest,
    IUpdateTodoRequestBody,
    IUpdateTodoRequestHeader,
    IUpdateTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.PATCH,
      path: dynamicPath,
    },
    {
      body: createUpdateTodoRequestBody,
      header: createUpdateTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
