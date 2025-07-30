import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateTodoStatusSuccessResponseBody,
  IUpdateTodoStatusSuccessResponseHeader,
  IUpdateTodoStatusSuccessResponse,
} from "../..";
import { UpdateTodoStatusSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createUpdateTodoStatusSuccessResponseHeaders =
  createDataFactory<IUpdateTodoStatusSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createUpdateTodoStatusSuccessResponseBody =
  createDataFactory<IUpdateTodoStatusSuccessResponseBody>(() => {
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

type UpdateTodoStatusSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUpdateTodoStatusSuccessResponseHeader>;
  body?: Partial<IUpdateTodoStatusSuccessResponseBody>;
};

export function createUpdateTodoStatusSuccessResponse(
  input: UpdateTodoStatusSuccessResponseInput = {}
): UpdateTodoStatusSuccessResponse {
  const responseData = createResponse<
    IUpdateTodoStatusSuccessResponse,
    IUpdateTodoStatusSuccessResponseBody,
    IUpdateTodoStatusSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createUpdateTodoStatusSuccessResponseBody,
      header: createUpdateTodoStatusSuccessResponseHeaders,
    },
    input
  );
  return new UpdateTodoStatusSuccessResponse(responseData);
}
