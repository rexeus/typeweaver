import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { PutTodoSuccessResponse } from "../..";
import { createResponse } from "../createResponse";
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
      header: createCreateTodoSuccessResponseHeader,
    },
    input
  );
  return new PutTodoSuccessResponse(responseData);
}
