import { createHeadTodoSuccessResponse as generatedCreateHeadTodoSuccessResponse } from "../../test-project/output/responses/HeadTodoSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import type {
  IHeadTodoSuccessResponse,
  IHeadTodoSuccessResponseHeader,
} from "../../index.js";

export const createHeadTodoSuccessResponseHeader =
  createDataFactory<IHeadTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

type CreateHeadTodoSuccessResponseInput = {
  header?: Partial<IHeadTodoSuccessResponseHeader>;
};

export function createHeadTodoSuccessResponse(
  input: CreateHeadTodoSuccessResponseInput = {}
): IHeadTodoSuccessResponse {
  const responseData = createResponse<
    IHeadTodoSuccessResponse,
    never,
    IHeadTodoSuccessResponseHeader
  >(
    {
      statusCode: 200,
    },
    {
      header: createHeadTodoSuccessResponseHeader,
    },
    input
  );
  return generatedCreateHeadTodoSuccessResponse(responseData);
}
