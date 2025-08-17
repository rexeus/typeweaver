import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IUpdateTodoRequest,
  IUpdateTodoRequestBody,
  IUpdateTodoRequestHeader,
  IUpdateTodoRequestParam,
} from "../..";

export const createUpdateTodoRequestHeader =
  createDataFactory<IUpdateTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createUpdateTodoRequestParam =
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
    ? createUpdateTodoRequestParam(input.param)
    : createUpdateTodoRequestParam();

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
      header: createUpdateTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
