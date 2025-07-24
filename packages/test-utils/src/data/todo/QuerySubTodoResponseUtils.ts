import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IQuerySubTodoSuccessResponseBody,
  IQuerySubTodoSuccessResponseHeader,
  IQuerySubTodoSuccessResponse,
} from "../..";
import { createData } from "../createData";

export function createQuerySubTodoSuccessResponseHeaders(
  input: Partial<IQuerySubTodoSuccessResponseHeader> = {}
): IQuerySubTodoSuccessResponseHeader {
  const defaults: IQuerySubTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createQuerySubTodoSuccessResponseBody(
  input: Partial<IQuerySubTodoSuccessResponseBody> = {}
): IQuerySubTodoSuccessResponseBody {
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

  const defaults: IQuerySubTodoSuccessResponseBody = {
    results,
    nextToken: faker.datatype.boolean() ? faker.string.alphanumeric(32) : undefined,
  };

  return createData(defaults, input);
}

type QuerySubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IQuerySubTodoSuccessResponseHeader>;
  body?: Partial<IQuerySubTodoSuccessResponseBody>;
};

export function createQuerySubTodoSuccessResponse(
  input: QuerySubTodoSuccessResponseInput = {}
): IQuerySubTodoSuccessResponse {
  const defaults: IQuerySubTodoSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createQuerySubTodoSuccessResponseHeaders(),
    body: createQuerySubTodoSuccessResponseBody(),
  };

  const overrides: Partial<IQuerySubTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createQuerySubTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createQuerySubTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}