import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ICreateSubTodoSuccessResponseBody,
  ICreateSubTodoSuccessResponseHeader,
  ICreateSubTodoSuccessResponse,
} from "../..";
import { CreateSubTodoSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createCreateSubTodoSuccessResponseHeader =
  createDataFactory<ICreateSubTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createCreateSubTodoSuccessResponseBody =
  createDataFactory<ICreateSubTodoSuccessResponseBody>(() => {
    const createdAt = faker.date.past().toISOString();
    const modifiedAt = faker.date.recent().toISOString();

    return {
      id: faker.string.ulid(),
      accountId: faker.string.ulid(),
      parentId: faker.helpers.arrayElement([faker.string.ulid(), undefined]),
      title: faker.lorem.sentence(),
      description: faker.helpers.arrayElement([
        faker.lorem.paragraph(),
        undefined,
      ]),
      status: faker.helpers.arrayElement([
        "TODO",
        "IN_PROGRESS",
        "DONE",
        "ARCHIVED",
      ] as const),
      dueDate: faker.helpers.arrayElement([
        faker.date.future().toISOString(),
        undefined,
      ]),
      tags: faker.helpers.arrayElement([
        [faker.lorem.word(), faker.lorem.word()] as string[],
        undefined,
      ]),
      priority: faker.helpers.arrayElement([
        faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
        undefined,
      ]),
      createdAt,
      modifiedAt,
      createdBy: faker.internet.username(),
      modifiedBy: faker.internet.username(),
    };
  });

type CreateSubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<ICreateSubTodoSuccessResponseHeader>;
  body?: Partial<ICreateSubTodoSuccessResponseBody>;
};

export function createCreateSubTodoSuccessResponse(
  input: CreateSubTodoSuccessResponseInput = {}
): CreateSubTodoSuccessResponse {
  const responseData = createResponse<
    ICreateSubTodoSuccessResponse,
    ICreateSubTodoSuccessResponseBody,
    ICreateSubTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CREATED,
    },
    {
      body: createCreateSubTodoSuccessResponseBody,
      header: createCreateSubTodoSuccessResponseHeader,
    },
    input
  );
  return new CreateSubTodoSuccessResponse(responseData);
}
