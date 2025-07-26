import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type { IListTodosRequest, IListTodosRequestHeader, IListTodosRequestQuery } from "../..";

export function createListTodosRequestHeaders(
  input: Partial<IListTodosRequestHeader> = {}
): IListTodosRequestHeader {
  const defaults: IListTodosRequestHeader = {
    "Accept": "application/json",
    "Authorization": `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createListTodosRequestQuery(
  input: Partial<IListTodosRequestQuery> = {}
): IListTodosRequestQuery {
  const defaults: IListTodosRequestQuery = {
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
  };

  return createData(defaults, input);
}

type CreateListTodosRequestInput = {
  path?: string;
  header?: Partial<IListTodosRequestHeader>;
  query?: Partial<IListTodosRequestQuery>;
};

export function createListTodosRequest(
  input: CreateListTodosRequestInput = {}
): IListTodosRequest {
  const defaults: IListTodosRequest = {
    method: HttpMethod.GET,
    path: "/todos",
    header: createListTodosRequestHeaders(),
    query: createListTodosRequestQuery(),
  };

  const overrides: Partial<IListTodosRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createListTodosRequestHeaders(input.header);
  if (input.query !== undefined)
    overrides.query = createListTodosRequestQuery(input.query);

  return createData(defaults, overrides as IListTodosRequest);
}
