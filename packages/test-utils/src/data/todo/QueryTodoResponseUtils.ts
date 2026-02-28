import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { QueryTodoSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import type {
  IQueryTodoSuccessResponse,
  IQueryTodoSuccessResponseBody,
  IQueryTodoSuccessResponseHeader,
} from "../..";

export const createQueryTodoSuccessResponseBody =
  createDataFactory<IQueryTodoSuccessResponseBody>(() => {
    const resultsLength = faker.number.int({ min: 0, max: 5 });
    const results = Array.from({ length: resultsLength }, () =>
      createGetTodoSuccessResponseBody()
    );

    return {
      results,
      nextToken: faker.helpers.arrayElement([
        faker.string.alphanumeric(32),
        undefined,
      ]),
    };
  });

type QueryTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IQueryTodoSuccessResponseHeader>;
  body?: Partial<IQueryTodoSuccessResponseBody>;
};

export function createQueryTodoSuccessResponse(
  input: QueryTodoSuccessResponseInput = {}
): QueryTodoSuccessResponse {
  const responseData = createResponse<
    IQueryTodoSuccessResponse,
    IQueryTodoSuccessResponseBody,
    IQueryTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createQueryTodoSuccessResponseBody,
      header: createCreateTodoSuccessResponseHeader,
    },
    input
  );
  return new QueryTodoSuccessResponse(responseData);
}
