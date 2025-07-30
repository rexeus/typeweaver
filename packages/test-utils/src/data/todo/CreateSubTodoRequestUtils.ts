import { HttpMethod } from "@rexeus/typeweaver-core";
import type { ICreateSubTodoRequest } from "../..";
import { faker } from "@faker-js/faker";
import type {
  ICreateSubTodoRequestHeader,
  ICreateSubTodoRequestParam,
  ICreateSubTodoRequestBody,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createCreateSubTodoRequestHeaders =
  createDataFactory<ICreateSubTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createCreateSubTodoRequestParams =
  createDataFactory<ICreateSubTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createCreateSubTodoRequestBody =
  createDataFactory<ICreateSubTodoRequestBody>(() => ({
    title: faker.lorem.sentence(),
    description: faker.helpers.arrayElement([faker.lorem.paragraph(), undefined]),
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
    ? createCreateSubTodoRequestParams(input.param)
    : createCreateSubTodoRequestParams();

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
      header: createCreateSubTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
