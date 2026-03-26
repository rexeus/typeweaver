import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createResponse } from "../createResponse";
import { createUpdateTodoSuccessResponse as generatedCreateUpdateTodoSuccessResponse } from "../../test-project/output/todo/UpdateTodoResponse";
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
): IUpdateTodoSuccessResponse {
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
  return generatedCreateUpdateTodoSuccessResponse(responseData);
}
