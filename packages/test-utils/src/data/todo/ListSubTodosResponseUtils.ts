import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IListSubTodosSuccessResponseBody,
  IListSubTodosSuccessResponseHeader,
  IListSubTodosSuccessResponse,
} from "../..";
import { createData } from "../createData";

export function createListSubTodosSuccessResponseHeaders(
  input: Partial<IListSubTodosSuccessResponseHeader> = {}
): IListSubTodosSuccessResponseHeader {
  const defaults: IListSubTodosSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createListSubTodosSuccessResponseBody(
  input: Partial<IListSubTodosSuccessResponseBody> = {}
): IListSubTodosSuccessResponseBody {
  const resultsLength = faker.number.int({ min: 0, max: 5 });
  const results = Array.from({ length: resultsLength }, () => {
    const createdAt = faker.date.past().toISOString();
    const modifiedAt = faker.date.recent().toISOString();
    
    return {
      id: faker.string.ulid(),
      accountId: faker.string.ulid(),
      parentId: faker.datatype.boolean() ? faker.string.ulid() : undefined,
      title: faker.lorem.sentence(),
      description: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
      status: faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED",
      dueDate: faker.datatype.boolean() ? faker.date.future().toISOString() : undefined,
      tags: faker.datatype.boolean() ? [faker.lorem.word(), faker.lorem.word()] : undefined,
      priority: faker.datatype.boolean() ? faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const) as ("LOW" | "MEDIUM" | "HIGH") : undefined,
      createdAt,
      modifiedAt,
      createdBy: faker.internet.username(),
      modifiedBy: faker.internet.username(),
    };
  });

  const defaults: IListSubTodosSuccessResponseBody = {
    results,
    nextToken: faker.datatype.boolean() ? faker.string.alphanumeric(32) : undefined,
  };

  return createData(defaults, input);
}

type ListSubTodosSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IListSubTodosSuccessResponseHeader>;
  body?: Partial<IListSubTodosSuccessResponseBody>;
};

export function createListSubTodosSuccessResponse(
  input: ListSubTodosSuccessResponseInput = {}
): IListSubTodosSuccessResponse {
  const defaults: IListSubTodosSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createListSubTodosSuccessResponseHeaders(),
    body: createListSubTodosSuccessResponseBody(),
  };

  const overrides: Partial<IListSubTodosSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createListSubTodosSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createListSubTodosSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}