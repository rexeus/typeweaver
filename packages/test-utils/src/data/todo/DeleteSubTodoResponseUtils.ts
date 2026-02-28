import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { DeleteSubTodoSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IDeleteSubTodoSuccessResponse,
  IDeleteSubTodoSuccessResponseBody,
  IDeleteSubTodoSuccessResponseHeader,
} from "../..";

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
): DeleteSubTodoSuccessResponse {
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
  return new DeleteSubTodoSuccessResponse(responseData);
}
