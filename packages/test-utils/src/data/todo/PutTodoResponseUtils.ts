import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import { createCreateTodoSuccessResponseHeaders } from "./CreateTodoResponseUtils";
import type {
  IPutTodoSuccessResponse,
  IPutTodoSuccessResponseHeader,
  IPutTodoSuccessResponseBody,
} from "../..";

export function createPutTodoSuccessResponseHeaders(
  input: Partial<IPutTodoSuccessResponseHeader> = {}
): IPutTodoSuccessResponseHeader {
  return createCreateTodoSuccessResponseHeaders(input);
}

export function createPutTodoSuccessResponseBody(
  input: Partial<IPutTodoSuccessResponseBody> = {}
): IPutTodoSuccessResponseBody {
  return createGetTodoSuccessResponseBody(input);
}

type PutTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IPutTodoSuccessResponseHeader>;
  body?: Partial<IPutTodoSuccessResponseBody>;
};

export function createPutTodoSuccessResponse(
  input: PutTodoSuccessResponseInput = {}
): IPutTodoSuccessResponse {
  const defaults: IPutTodoSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createPutTodoSuccessResponseHeaders(),
    body: createPutTodoSuccessResponseBody(),
  };

  const overrides: Partial<IPutTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createPutTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined) overrides.body = createPutTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}