import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDeleteSubTodoSuccessResponse as generatedCreateDeleteSubTodoSuccessResponse } from "../../test-project/output/responses/DeleteSubTodoSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import type {
  IDeleteSubTodoSuccessResponse,
  IDeleteSubTodoSuccessResponseBody,
  IDeleteSubTodoSuccessResponseHeader,
} from "../../index.js";

export const createDeleteSubTodoSuccessResponseHeader =
  createDataFactory<IDeleteSubTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createDeleteSubTodoSuccessResponseBody =
  createDataFactory<IDeleteSubTodoSuccessResponseBody>(() => ({
    message: faker.lorem.sentence(),
  }));

type DeleteSubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IDeleteSubTodoSuccessResponseHeader>;
  body?: Partial<IDeleteSubTodoSuccessResponseBody>;
};

export function createDeleteSubTodoSuccessResponse(
  input: DeleteSubTodoSuccessResponseInput = {}
): IDeleteSubTodoSuccessResponse {
  const responseData = createResponse<
    IDeleteSubTodoSuccessResponse,
    IDeleteSubTodoSuccessResponseBody,
    IDeleteSubTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createDeleteSubTodoSuccessResponseBody,
      header: createDeleteSubTodoSuccessResponseHeader,
    },
    input
  );
  return generatedCreateDeleteSubTodoSuccessResponse(responseData);
}
