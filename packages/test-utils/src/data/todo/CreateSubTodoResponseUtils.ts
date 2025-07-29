import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ICreateSubTodoSuccessResponseBody,
  ICreateSubTodoSuccessResponseHeader,
  ICreateSubTodoSuccessResponse,
} from "../..";
import { createData } from "../createData";

export function createCreateSubTodoSuccessResponseHeaders(
  input: Partial<ICreateSubTodoSuccessResponseHeader> = {}
): ICreateSubTodoSuccessResponseHeader {
  const defaults: ICreateSubTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createCreateSubTodoSuccessResponseBody(
  input: Partial<ICreateSubTodoSuccessResponseBody> = {}
): ICreateSubTodoSuccessResponseBody {
  const createdAt = faker.date.past().toISOString();
  const modifiedAt = faker.date.recent().toISOString();

  const defaults: ICreateSubTodoSuccessResponseBody = {
    id: faker.string.ulid(),
    accountId: faker.string.ulid(),
    parentId: faker.datatype.boolean() ? faker.string.ulid() : undefined,
    title: faker.lorem.sentence(),
    description: faker.datatype.boolean() ? faker.lorem.paragraph() : undefined,
    status: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
    dueDate: faker.datatype.boolean()
      ? faker.date.future().toISOString()
      : undefined,
    tags: faker.datatype.boolean()
      ? [faker.lorem.word(), faker.lorem.word()]
      : undefined,
    priority: faker.datatype.boolean()
      ? faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const)
      : undefined,
    createdAt,
    modifiedAt,
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}

type CreateSubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<ICreateSubTodoSuccessResponseHeader>;
  body?: Partial<ICreateSubTodoSuccessResponseBody>;
};

export function createCreateSubTodoSuccessResponse(
  input: CreateSubTodoSuccessResponseInput = {}
): ICreateSubTodoSuccessResponse {
  const defaults: ICreateSubTodoSuccessResponse = {
    statusCode: HttpStatusCode.CREATED,
    header: createCreateSubTodoSuccessResponseHeaders(),
    body: createCreateSubTodoSuccessResponseBody(),
  };

  const overrides: Partial<ICreateSubTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createCreateSubTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createCreateSubTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
