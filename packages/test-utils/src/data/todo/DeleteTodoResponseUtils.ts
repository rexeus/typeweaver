import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDeleteTodoSuccessResponse as generatedCreateDeleteTodoSuccessResponse } from "../../test-project/output/responses/DeleteTodoSuccessResponse.js";
import { createResponse } from "../createResponse.js";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils.js";
import type {
  IDeleteTodoSuccessResponse,
  IDeleteTodoSuccessResponseHeader,
} from "../../index.js";

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
