import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createResponse } from "../createResponse";
import { createPutTodoSuccessResponse as generatedCreatePutTodoSuccessResponse } from "../../test-project/output/todo/PutTodoResponse";
import { createCreateTodoSuccessResponseHeader } from "./CreateTodoResponseUtils";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import type {
  IPutTodoSuccessResponse,
  IPutTodoSuccessResponseBody,
  IPutTodoSuccessResponseHeader,
} from "../..";

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
