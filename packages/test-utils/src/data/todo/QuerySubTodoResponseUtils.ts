import { faker } from "@faker-js/faker";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { QuerySubTodoSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IQuerySubTodoSuccessResponse,
  IQuerySubTodoSuccessResponseBody,
  IQuerySubTodoSuccessResponseHeader,
} from "../..";

export const createQuerySubTodoSuccessResponseHeader =
  createDataFactory<IQuerySubTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createQuerySubTodoSuccessResponseBody =
  createDataFactory<IQuerySubTodoSuccessResponseBody>(() => {
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

type QuerySubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IQuerySubTodoSuccessResponseHeader>;
  body?: Partial<IQuerySubTodoSuccessResponseBody>;
};

export function createQuerySubTodoSuccessResponse(
  input: QuerySubTodoSuccessResponseInput = {}
): QuerySubTodoSuccessResponse {
  const responseData = createResponse<
    IQuerySubTodoSuccessResponse,
    IQuerySubTodoSuccessResponseBody,
    IQuerySubTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createQuerySubTodoSuccessResponseBody,
      header: createQuerySubTodoSuccessResponseHeader,
    },
    input
  );
  return new QuerySubTodoSuccessResponse(responseData);
}
