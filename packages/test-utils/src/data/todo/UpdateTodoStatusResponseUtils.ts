import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateTodoStatusSuccessResponseBody,
  IUpdateTodoStatusSuccessResponseHeader,
  IUpdateTodoStatusSuccessResponse,
} from "../..";
import { createData } from "../createData";

export function createUpdateTodoStatusSuccessResponseHeaders(
  input: Partial<IUpdateTodoStatusSuccessResponseHeader> = {}
): IUpdateTodoStatusSuccessResponseHeader {
  const defaults: IUpdateTodoStatusSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createUpdateTodoStatusSuccessResponseBody(
  input: Partial<IUpdateTodoStatusSuccessResponseBody> = {}
): IUpdateTodoStatusSuccessResponseBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();
  
  const defaults: IUpdateTodoStatusSuccessResponseBody = {
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

type UpdateTodoStatusSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUpdateTodoStatusSuccessResponseHeader>;
  body?: Partial<IUpdateTodoStatusSuccessResponseBody>;
};

export function createUpdateTodoStatusSuccessResponse(
  input: UpdateTodoStatusSuccessResponseInput = {}
): IUpdateTodoStatusSuccessResponse {
  const defaults: IUpdateTodoStatusSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createUpdateTodoStatusSuccessResponseHeaders(),
    body: createUpdateTodoStatusSuccessResponseBody(),
  };

  const overrides: Partial<IUpdateTodoStatusSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createUpdateTodoStatusSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createUpdateTodoStatusSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}