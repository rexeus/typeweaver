import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IUpdateSubTodoRequest } from "../..";
import { faker } from "@faker-js/faker";
import type {
  IUpdateSubTodoRequestHeader,
  IUpdateSubTodoRequestParam,
  IUpdateSubTodoRequestBody,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createUpdateSubTodoRequestHeaders =
  createDataFactory<IUpdateSubTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createUpdateSubTodoRequestParams =
  createDataFactory<IUpdateSubTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
    subtodoId: faker.string.ulid(),
  }));

export const createUpdateSubTodoRequestBody =
  createDataFactory<IUpdateSubTodoRequestBody>(() => ({
    title: faker.helpers.arrayElement([faker.lorem.sentence(), undefined]),
    description: faker.helpers.arrayElement([faker.lorem.paragraph(), undefined]),
    status: faker.helpers.arrayElement([
      faker.helpers.arrayElement([
        "TODO",
        "IN_PROGRESS",
        "DONE",
        "ARCHIVED",
      ] as const),
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

type UpdateSubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IUpdateSubTodoRequestHeader>;
  param?: Partial<IUpdateSubTodoRequestParam>;
  body?: Partial<IUpdateSubTodoRequestBody>;
};

export function createUpdateSubTodoRequest(
  input: UpdateSubTodoRequestInput = {}
): IUpdateSubTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createUpdateSubTodoRequestParams(input.param)
    : createUpdateSubTodoRequestParams();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath =
    input.path ?? `/todos/${param.todoId}/subtodos/${param.subtodoId}`;

  return createRequest<
    IUpdateSubTodoRequest,
    IUpdateSubTodoRequestBody,
    IUpdateSubTodoRequestHeader,
    IUpdateSubTodoRequestParam,
    never
  >(
    {
      method: HttpMethod.PUT,
      path: dynamicPath,
    },
    {
      body: createUpdateSubTodoRequestBody,
      header: createUpdateSubTodoRequestHeaders,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
