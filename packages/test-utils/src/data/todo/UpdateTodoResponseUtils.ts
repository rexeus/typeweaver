import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { UpdateTodoSuccessResponse } from "../..";
import { createResponse } from "../createResponse";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import type {
  IUpdateTodoSuccessResponse,
  IUpdateTodoSuccessResponseBody,
  IUpdateTodoSuccessResponseHeader,
} from "../..";

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
