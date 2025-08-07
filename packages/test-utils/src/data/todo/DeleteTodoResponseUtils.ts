import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createResponse } from "../createResponse";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils";
import type {
  IDeleteTodoSuccessResponse,
  IDeleteTodoSuccessResponseHeader,
} from "../..";
import { DeleteTodoSuccessResponse } from "../..";

type DeleteTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IDeleteTodoSuccessResponseHeader>;
};

export function createDeleteTodoSuccessResponse(
  input: DeleteTodoSuccessResponseInput = {}
): DeleteTodoSuccessResponse {
  const responseData = createResponse<
    IDeleteTodoSuccessResponse,
    never,
    IDeleteTodoSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.NO_CONTENT,
    },
    {
      header: createCreateTodoSuccessResponseHeader,
    },
    input
  );
  return new DeleteTodoSuccessResponse(responseData);
}
