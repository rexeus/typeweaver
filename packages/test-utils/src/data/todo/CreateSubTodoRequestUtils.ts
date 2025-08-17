import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  ICreateSubTodoRequest,
  ICreateSubTodoRequestBody,
  ICreateSubTodoRequestHeader,
  ICreateSubTodoRequestParam,
} from "../..";

export const createCreateSubTodoRequestHeader =
  createDataFactory<ICreateSubTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createCreateSubTodoRequestParam =
  createDataFactory<ICreateSubTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createCreateSubTodoRequestBody =
  createDataFactory<ICreateSubTodoRequestBody>(() => ({
    title: faker.lorem.sentence(),
    description: faker.helpers.arrayElement([
      faker.lorem.paragraph(),
      undefined,
    ]),
    dueDate: faker.helpers.arrayElement([
      faker.date.future().toISOString(),
      undefined,
    ]),
    tags: faker.helpers.arrayElement([
      [faker.lorem.word(), faker.lorem.word()],
      undefined,
    ]),
    priority: faker.helpers.arrayElement([
      faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
      undefined,
    ]),
  }));

type CreateSubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<ICreateSubTodoRequestHeader>;
  param?: Partial<ICreateSubTodoRequestParam>;
  body?: Partial<ICreateSubTodoRequestBody>;
};

export function createCreateSubTodoRequest(
  input: CreateSubTodoRequestInput = {}
): ICreateSubTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createCreateSubTodoRequestParam(input.param)
    : createCreateSubTodoRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}/subtodos`;

  return createRequest<
    ICreateSubTodoRequest,
    ICreateSubTodoRequestBody,
    ICreateSubTodoRequestHeader,
    ICreateSubTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.POST,
      path: dynamicPath,
    },
    {
      body: createCreateSubTodoRequestBody,
      header: createCreateSubTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
