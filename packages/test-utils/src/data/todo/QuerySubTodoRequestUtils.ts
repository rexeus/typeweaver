import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IQuerySubTodoRequest,
  IQuerySubTodoRequestBody,
  IQuerySubTodoRequestHeader,
  IQuerySubTodoRequestParam,
  IQuerySubTodoRequestQuery,
} from "../..";

export const createQuerySubTodoRequestHeader =
  createDataFactory<IQuerySubTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createQuerySubTodoRequestParam =
  createDataFactory<IQuerySubTodoRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createQuerySubTodoRequestQuery =
  createDataFactory<IQuerySubTodoRequestQuery>(() => ({
    limit: faker.number.int({ min: 1, max: 100 }).toString(),
    sortBy: faker.helpers.arrayElement([
      "title",
      "dueDate",
      "priority",
      "createdAt",
      "modifiedAt",
    ]),
    sortOrder: faker.helpers.arrayElement(["asc", "desc"]),
    format: faker.helpers.arrayElement(["summary", "detailed"]),
  }));

export const createQuerySubTodoRequestBody =
  createDataFactory<IQuerySubTodoRequestBody>(() => ({
    searchText: faker.lorem.words(3),
    status: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
    dateRange: {
      from: faker.date.past().toISOString().split("T")[0],
      to: faker.date.future().toISOString().split("T")[0],
    },
    tags: [faker.lorem.word(), faker.lorem.word()],
  }));

type QuerySubTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IQuerySubTodoRequestHeader>;
  param?: Partial<IQuerySubTodoRequestParam>;
  query?: Partial<IQuerySubTodoRequestQuery>;
  body?: Partial<IQuerySubTodoRequestBody>;
};

export function createQuerySubTodoRequest(
  input: QuerySubTodoRequestInput = {}
): IQuerySubTodoRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createQuerySubTodoRequestParam(input.param)
    : createQuerySubTodoRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}/subtodos/query`;

  return createRequest<
    IQuerySubTodoRequest,
    IQuerySubTodoRequestBody,
    IQuerySubTodoRequestHeader,
    IQuerySubTodoRequestParam,
    IQuerySubTodoRequestQuery
  >(
    {
      method: HttpMethod.POST,
      path: dynamicPath,
    },
    {
      body: createQuerySubTodoRequestBody,
      header: createQuerySubTodoRequestHeader,
      param: () => param, // Use pre-generated param
      query: createQuerySubTodoRequestQuery,
    },
    input
  );
}
