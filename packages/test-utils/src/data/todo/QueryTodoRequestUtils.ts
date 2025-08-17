import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IQueryTodoRequest,
  IQueryTodoRequestBody,
  IQueryTodoRequestHeader,
  IQueryTodoRequestQuery,
} from "../..";

export const createQueryTodoRequestHeader =
  createDataFactory<IQueryTodoRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createQueryTodoRequestQuery =
  createDataFactory<IQueryTodoRequestQuery>(() => ({
    limit: faker.helpers.arrayElement([
      faker.number.int({ min: 1, max: 100 }).toString(),
      undefined,
    ]),
    nextToken: faker.helpers.arrayElement([
      faker.string.alphanumeric(32),
      undefined,
    ]),
    sortBy: faker.helpers.arrayElement([
      faker.helpers.arrayElement([
        "title",
        "dueDate",
        "priority",
        "createdAt",
        "modifiedAt",
      ]),
      undefined,
    ]),
    sortOrder: faker.helpers.arrayElement([
      faker.helpers.arrayElement(["asc", "desc"]),
      undefined,
    ]),
  }));

export const createQueryTodoRequestBody =
  createDataFactory<IQueryTodoRequestBody>(() => ({
    searchText: faker.helpers.arrayElement([faker.lorem.words(3), undefined]),
    accountId: faker.helpers.arrayElement([faker.string.ulid(), undefined]),
    status: faker.helpers.arrayElement([
      faker.helpers.arrayElement([
        "TODO",
        "IN_PROGRESS",
        "DONE",
        "ARCHIVED",
      ] as const),
      undefined,
    ]),
    priority: faker.helpers.arrayElement([
      faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
      undefined,
    ]),
    dateRange: faker.helpers.arrayElement([
      {
        from: faker.helpers.arrayElement([
          faker.date.past().toISOString().split("T")[0],
          undefined,
        ]),
        to: faker.helpers.arrayElement([
          faker.date.future().toISOString().split("T")[0],
          undefined,
        ]),
      },
      undefined,
    ]),
    tags: faker.helpers.arrayElement([
      [faker.lorem.word(), faker.lorem.word()],
      undefined,
    ]),
    hasParent: faker.helpers.arrayElement([true, false, undefined]),
  }));

type QueryTodoRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IQueryTodoRequestHeader>;
  query?: Partial<IQueryTodoRequestQuery>;
  body?: Partial<IQueryTodoRequestBody>;
};

export function createQueryTodoRequest(
  input: QueryTodoRequestInput = {}
): IQueryTodoRequest {
  return createRequest<
    IQueryTodoRequest,
    IQueryTodoRequestBody,
    IQueryTodoRequestHeader,
    never,
    IQueryTodoRequestQuery
  >(
    {
      method: HttpMethod.POST,
      path: "/todos/query",
    },
    {
      body: createQueryTodoRequestBody,
      header: createQueryTodoRequestHeader,
      query: createQueryTodoRequestQuery,
    },
    input
  );
}
