import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import type {
  IGetTodoSuccessResponse,
  IGetTodoSuccessResponseHeader,
  IGetTodoSuccessResponseBody,
} from "../..";

export function createGetTodoSuccessResponseHeaders(
  input: Partial<IGetTodoSuccessResponseHeader> = {}
): IGetTodoSuccessResponseHeader {
  const defaults: IGetTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createGetTodoSuccessResponseBody(
  input: Partial<IGetTodoSuccessResponseBody> = {}
): IGetTodoSuccessResponseBody {
  const defaults: IGetTodoSuccessResponseBody = {
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

type GetTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IGetTodoSuccessResponseHeader>;
  body?: Partial<IGetTodoSuccessResponseBody>;
};

export function createGetTodoSuccessResponse(
  input: GetTodoSuccessResponseInput = {}
): IGetTodoSuccessResponse {
  const defaults: IGetTodoSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createGetTodoSuccessResponseHeaders(),
    body: createGetTodoSuccessResponseBody(),
  };

  const overrides: Partial<IGetTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createGetTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createGetTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
