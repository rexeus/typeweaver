import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  ICreateTodoSuccessResponse,
  ICreateTodoSuccessResponseHeader,
  ICreateTodoSuccessResponseBody,
} from "../..";

export const createCreateTodoSuccessResponseHeaders = createDataFactory<ICreateTodoSuccessResponseHeader>(() => ({
  "Content-Type": "application/json",
}));

export const createCreateTodoSuccessResponseBody = createDataFactory<ICreateTodoSuccessResponseBody>(() => ({
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
}));

type CreateTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<ICreateTodoSuccessResponseHeader>;
  body?: Partial<ICreateTodoSuccessResponseBody>;
};

export function createCreateTodoSuccessResponse(
  input: CreateTodoSuccessResponseInput = {}
): ICreateTodoSuccessResponse {
  return createResponse<ICreateTodoSuccessResponse, ICreateTodoSuccessResponseBody, ICreateTodoSuccessResponseHeader>(
    {
      statusCode: HttpStatusCode.CREATED,
    },
    {
      body: createCreateTodoSuccessResponseBody,
      header: createCreateTodoSuccessResponseHeaders,
    },
    input
  );
}
