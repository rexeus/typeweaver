import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createResponse } from "../createResponse";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import { createCreateTodoSuccessResponseHeaders } from "./CreateTodoResponseUtils";
import type {
  IPutTodoSuccessResponse,
  IPutTodoSuccessResponseHeader,
  IPutTodoSuccessResponseBody,
} from "../..";
import { PutTodoSuccessResponse } from "../..";

type PutTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IPutTodoSuccessResponseHeader>;
  body?: Partial<IPutTodoSuccessResponseBody>;
};

export function createPutTodoSuccessResponse(
  input: PutTodoSuccessResponseInput = {}
): PutTodoSuccessResponse {
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
      header: createCreateTodoSuccessResponseHeaders,
    },
    input
  );
  return new PutTodoSuccessResponse(responseData);
}
