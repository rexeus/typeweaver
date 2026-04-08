import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createQueryTodoSuccessResponse as generatedCreateQueryTodoSuccessResponse } from "../../test-project/output/responses/QueryTodoSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils.js";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils.js";
import type {
  IQueryTodoSuccessResponse,
  IQueryTodoSuccessResponseBody,
  IQueryTodoSuccessResponseHeader,
} from "../../index.js";

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
): IQueryTodoSuccessResponse {
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
  return generatedCreateQueryTodoSuccessResponse(responseData);
}
