import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IPutTodoRequest,
  IPutTodoRequestBody,
  IPutTodoRequestHeader,
  IPutTodoRequestParam,
} from "../..";

export const createPutTodoRequestHeader =
  createDataFactory<IPutTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createPutTodoRequestParam =
  createDataFactory<IPutTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createPutTodoRequestBody = createDataFactory<IPutTodoRequestBody>(
  () => ({
    accountId: faker.string.ulid(),
    parentId: faker.string.ulid(),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
  })
);

type PutTodoRequestInput = {
  path?: string;
  header?: Partial<IPutTodoRequestHeader>;
  param?: Partial<IPutTodoRequestParam>;
  body?: Partial<IPutTodoRequestBody>;
};

export function createPutTodoRequest(
  input: PutTodoRequestInput = {}
): IPutTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createPutTodoRequestParam(input.param)
    : createPutTodoRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}`;

  return createRequest<
    IPutTodoRequest,
    IPutTodoRequestBody,
    IPutTodoRequestHeader,
    IPutTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.PUT,
      path: dynamicPath,
    },
    {
      body: createPutTodoRequestBody,
      header: createPutTodoRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
