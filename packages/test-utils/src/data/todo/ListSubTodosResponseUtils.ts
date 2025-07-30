import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IListSubTodosSuccessResponseBody,
  IListSubTodosSuccessResponseHeader,
  IListSubTodosSuccessResponse,
} from "../..";
import { ListSubTodosSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createListSubTodosSuccessResponseHeaders =
  createDataFactory<IListSubTodosSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createListSubTodosSuccessResponseBody =
  createDataFactory<IListSubTodosSuccessResponseBody>(() => {
    const resultsLength = faker.number.int({ min: 0, max: 5 });
    const results = Array.from({ length: resultsLength }, () => {
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
        ] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED",
        dueDate: faker.helpers.arrayElement([
          faker.date.future().toISOString(),
          undefined,
        ]),
        tags: faker.helpers.arrayElement([
          [faker.lorem.word(), faker.lorem.word()] as string[],
          undefined,
        ]),
        priority: faker.helpers.arrayElement([
          faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const) as
            | "LOW"
            | "MEDIUM"
            | "HIGH",
          undefined,
        ]),
        createdAt,
        modifiedAt,
        createdBy: faker.internet.username(),
        modifiedBy: faker.internet.username(),
      };
    });

    return {
      results,
      nextToken: faker.helpers.arrayElement([
        faker.string.alphanumeric(32),
        undefined,
      ]),
    };
  });

type ListSubTodosSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IListSubTodosSuccessResponseHeader>;
  body?: Partial<IListSubTodosSuccessResponseBody>;
};

export function createListSubTodosSuccessResponse(
  input: ListSubTodosSuccessResponseInput = {}
): ListSubTodosSuccessResponse {
  const responseData = createResponse<
    IListSubTodosSuccessResponse,
    IListSubTodosSuccessResponseBody,
    IListSubTodosSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createListSubTodosSuccessResponseBody,
      header: createListSubTodosSuccessResponseHeaders,
    },
    input
  );
  return new ListSubTodosSuccessResponse(responseData);
}
