import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import type {
  ICreateTodoSuccessResponse,
  ICreateTodoSuccessResponseHeader,
  ICreateTodoSuccessResponseBody,
} from "../..";

export function createCreateTodoSuccessResponseHeaders(
  input: Partial<ICreateTodoSuccessResponseHeader> = {}
): ICreateTodoSuccessResponseHeader {
  const defaults: ICreateTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createCreateTodoSuccessResponseBody(
  input: Partial<ICreateTodoSuccessResponseBody> = {}
): ICreateTodoSuccessResponseBody {
  const defaults: ICreateTodoSuccessResponseBody = {
    id: faker.string.ulid(),
    accountId: faker.string.ulid(),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}

type CreateTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<ICreateTodoSuccessResponseHeader>;
  body?: Partial<ICreateTodoSuccessResponseBody>;
};

export function createCreateTodoSuccessResponse(
  input: CreateTodoSuccessResponseInput = {}
): ICreateTodoSuccessResponse {
  const defaults: ICreateTodoSuccessResponse = {
    statusCode: HttpStatusCode.CREATED,
    header: createCreateTodoSuccessResponseHeaders(),
    body: createCreateTodoSuccessResponseBody(),
  };

  const overrides: Partial<ICreateTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createCreateTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createCreateTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
