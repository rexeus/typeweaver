import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createPutTodoSuccessResponse as generatedCreatePutTodoSuccessResponse } from "../../test-project/output/responses/PutTodoSuccessResponse.js";
import { createResponse } from "../createResponse.js";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils.js";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils.js";
import type {
  IPutTodoSuccessResponse,
  IPutTodoSuccessResponseBody,
  IPutTodoSuccessResponseHeader,
} from "../../index.js";

type PutTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IPutTodoSuccessResponseHeader>;
  body?: Partial<IPutTodoSuccessResponseBody>;
};

export function createPutTodoSuccessResponse(
  input: PutTodoSuccessResponseInput = {}
): IPutTodoSuccessResponse {
  const responseData = createResponse<
    IPutTodoSuccessResponse,
    IPutTodoSuccessResponseBody,
    IPutTodoSuccessResponseHeader
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
  return generatedCreatePutTodoSuccessResponse(responseData);
}
