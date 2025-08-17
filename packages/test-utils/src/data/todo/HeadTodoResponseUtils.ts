import { HeadTodoSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IHeadTodoSuccessResponse,
  IHeadTodoSuccessResponseHeader,
} from "../..";

export const createHeadTodoSuccessResponseHeader =
  createDataFactory<IHeadTodoSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

type CreateHeadTodoSuccessResponseInput = {
  header?: Partial<IHeadTodoSuccessResponseHeader>;
};

export function createHeadTodoSuccessResponse(
  input: CreateHeadTodoSuccessResponseInput = {}
): HeadTodoSuccessResponse {
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
  return new HeadTodoSuccessResponse(responseData);
}
