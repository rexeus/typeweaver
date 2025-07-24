import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateSubTodoSuccessResponseBody,
  IUpdateSubTodoSuccessResponseHeader,
  IUpdateSubTodoSuccessResponse,
} from "../..";
import { createData } from "../createData";

export function createUpdateSubTodoSuccessResponseHeaders(
  input: Partial<IUpdateSubTodoSuccessResponseHeader> = {}
): IUpdateSubTodoSuccessResponseHeader {
  const defaults: IUpdateSubTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createUpdateSubTodoSuccessResponseBody(
  input: Partial<IUpdateSubTodoSuccessResponseBody> = {}
): IUpdateSubTodoSuccessResponseBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();
  
  const defaults: IUpdateSubTodoSuccessResponseBody = {
    id: faker.string.ulid(),
    accountId: faker.string.ulid(),
    parentId: faker.datatype.boolean() ? faker.string.ulid() : undefined,
    title: faker.lorem.sentence(),
    description: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
    status: faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const),
    dueDate: faker.datatype.boolean() ? faker.date.future().toISOString() : undefined,
    tags: faker.datatype.boolean() ? [faker.lorem.word(), faker.lorem.word()] : undefined,
    priority: faker.datatype.boolean() ? faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const) : undefined,
    createdAt,
    modifiedAt,
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}

type UpdateSubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUpdateSubTodoSuccessResponseHeader>;
  body?: Partial<IUpdateSubTodoSuccessResponseBody>;
};

export function createUpdateSubTodoSuccessResponse(
  input: UpdateSubTodoSuccessResponseInput = {}
): IUpdateSubTodoSuccessResponse {
  const defaults: IUpdateSubTodoSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createUpdateSubTodoSuccessResponseHeaders(),
    body: createUpdateSubTodoSuccessResponseBody(),
  };

  const overrides: Partial<IUpdateSubTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createUpdateSubTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createUpdateSubTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}