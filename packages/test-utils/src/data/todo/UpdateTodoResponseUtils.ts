import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createResponse } from "../createResponse";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils";
import type {
  IUpdateTodoSuccessResponse,
  IUpdateTodoSuccessResponseHeader,
  IUpdateTodoSuccessResponseBody,
} from "../..";
import { UpdateTodoSuccessResponse } from "../..";

type UpdateTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUpdateTodoSuccessResponseHeader>;
  body?: Partial<IUpdateTodoSuccessResponseBody>;
};

export function createUpdateTodoSuccessResponse(
  input: UpdateTodoSuccessResponseInput = {}
): UpdateTodoSuccessResponse {
  const responseData = createResponse<
    IUpdateTodoSuccessResponse,
    IUpdateTodoSuccessResponseBody,
    IUpdateTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createGetTodoSuccessResponseBody,
      header: createCreateTodoSuccessResponseHeader,
    },
    input
  );
  return new UpdateTodoSuccessResponse(responseData);
}
