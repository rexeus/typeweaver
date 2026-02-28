import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { UpdateSubTodoSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IUpdateSubTodoSuccessResponse,
  IUpdateSubTodoSuccessResponseBody,
  IUpdateSubTodoSuccessResponseHeader,
} from "../..";

export const createUpdateSubTodoSuccessResponseHeader =
  createDataFactory<IUpdateSubTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createUpdateSubTodoSuccessResponseBody =
  createDataFactory<IUpdateSubTodoSuccessResponseBody>(() => {
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
        [faker.lorem.word(), faker.lorem.word()],
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

type UpdateSubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUpdateSubTodoSuccessResponseHeader>;
  body?: Partial<IUpdateSubTodoSuccessResponseBody>;
};

export function createUpdateSubTodoSuccessResponse(
  input: UpdateSubTodoSuccessResponseInput = {}
): UpdateSubTodoSuccessResponse {
  const responseData = createResponse<
    IUpdateSubTodoSuccessResponse,
    IUpdateSubTodoSuccessResponseBody,
    IUpdateSubTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createUpdateSubTodoSuccessResponseBody,
      header: createUpdateSubTodoSuccessResponseHeader,
    },
    input
  );
  return new UpdateSubTodoSuccessResponse(responseData);
}
