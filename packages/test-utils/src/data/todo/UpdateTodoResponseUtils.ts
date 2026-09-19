import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createUpdateTodoSuccessResponse as generatedCreateUpdateTodoSuccessResponse } from "../../test-project/output/responses/UpdateTodoSuccessResponse.js";
import { createResponse } from "../createResponse.js";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils.js";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils.js";
import type {
  IUpdateTodoSuccessResponse,
  IUpdateTodoSuccessResponseBody,
  IUpdateTodoSuccessResponseHeader,
} from "../../index.js";
import type { DataOverrides } from "../createData.js";

type UpdateTodoSuccessResponseInput = {
  statusCode?: number;
  header?: DataOverrides<IUpdateTodoSuccessResponseHeader>;
  body?: DataOverrides<IUpdateTodoSuccessResponseBody>;
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
