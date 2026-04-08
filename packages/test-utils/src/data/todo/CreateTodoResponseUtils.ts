import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createCreateTodoSuccessResponse as generatedCreateCreateTodoSuccessResponse } from "../../test-project/output/responses/CreateTodoSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import type {
  ICreateTodoSuccessResponse,
  ICreateTodoSuccessResponseBody,
  ICreateTodoSuccessResponseHeader,
} from "../../index.js";

export const createCreateTodoSuccessResponseHeader =
  createDataFactory<ICreateTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createCreateTodoSuccessResponseBody =
  createDataFactory<ICreateTodoSuccessResponseBody>(() => ({
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
  const responseData = createResponse<
    ICreateTodoSuccessResponse,
    ICreateTodoSuccessResponseBody,
    ICreateTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CREATED,
    },
    {
      body: createCreateTodoSuccessResponseBody,
      header: createCreateTodoSuccessResponseHeader,
    },
    input
  );
  return generatedCreateCreateTodoSuccessResponse(responseData);
}
