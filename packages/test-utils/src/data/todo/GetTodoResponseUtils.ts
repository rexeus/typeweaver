import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IGetTodoSuccessResponse,
  IGetTodoSuccessResponseHeader,
  IGetTodoSuccessResponseBody,
} from "../..";
import { GetTodoSuccessResponse } from "../..";

export const createGetTodoSuccessResponseHeader =
  createDataFactory<IGetTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createGetTodoSuccessResponseBody =
  createDataFactory<IGetTodoSuccessResponseBody>(() => ({
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

type GetTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IGetTodoSuccessResponseHeader>;
  body?: Partial<IGetTodoSuccessResponseBody>;
};

export function createGetTodoSuccessResponse(
  input: GetTodoSuccessResponseInput = {}
): GetTodoSuccessResponse {
  const responseData = createResponse<
    IGetTodoSuccessResponse,
    IGetTodoSuccessResponseBody,
    IGetTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createGetTodoSuccessResponseBody,
      header: createGetTodoSuccessResponseHeader,
    },
    input
  );
  return new GetTodoSuccessResponse(responseData);
}
