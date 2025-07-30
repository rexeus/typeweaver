import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import { createCreateTodoSuccessResponseHeaders } from "./CreateTodoResponseUtils";
import type {
  IQueryTodoSuccessResponse,
  IQueryTodoSuccessResponseHeader,
  IQueryTodoSuccessResponseBody,
} from "../..";
import { QueryTodoSuccessResponse } from "../..";

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
      header: createCreateTodoSuccessResponseHeaders,
    },
    input
  );
  return new QueryTodoSuccessResponse(responseData);
}
