import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IListTodosRequest,
  IListTodosRequestHeader,
  IListTodosRequestQuery,
} from "../..";

export const createListTodosRequestHeader =
  createDataFactory<IListTodosRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createListTodosRequestQuery =
  createDataFactory<IListTodosRequestQuery>(() => ({
    status: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
    tags: [faker.lorem.word(), faker.lorem.word()],
    limit: faker.number.int({ min: 1, max: 100 }).toString(),
    nextToken: faker.string.alphanumeric(32),
    sortBy: faker.helpers.arrayElement([
      "title",
      "dueDate",
      "priority",
      "createdAt",
      "modifiedAt",
    ] as const),
    sortOrder: faker.helpers.arrayElement(["asc", "desc"] as const),
    search: faker.lorem.word(),
    dateFrom: faker.date.past().toISOString().split("T")[0],
    dateTo: faker.date.future().toISOString().split("T")[0],
  }));

type ListTodosRequestInput = {
  path?: string;
  header?: Partial<IListTodosRequestHeader>;
  query?: Partial<IListTodosRequestQuery>;
};

export function createListTodosRequest(
  input: ListTodosRequestInput = {}
): IListTodosRequest {
  return createRequest<
    IListTodosRequest,
    never,
    IListTodosRequestHeader,
    never,
    IListTodosRequestQuery
  >(
    {
      method: HttpMethod.GET,
      path: "/todos",
    },
    {
      header: createListTodosRequestHeader,
      query: createListTodosRequestQuery,
    },
    input
  );
}
