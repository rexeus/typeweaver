import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createResponse } from "../createResponse";
import { createDeleteTodoSuccessResponse as generatedCreateDeleteTodoSuccessResponse } from "../../test-project/output/todo/DeleteTodoResponse";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils";
import type {
  IDeleteTodoSuccessResponse,
  IDeleteTodoSuccessResponseHeader,
} from "../..";

type DeleteTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IDeleteTodoSuccessResponseHeader>;
};

export function createDeleteTodoSuccessResponse(
  input: DeleteTodoSuccessResponseInput = {}
): IDeleteTodoSuccessResponse {
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
  return generatedCreateDeleteTodoSuccessResponse(responseData);
}
