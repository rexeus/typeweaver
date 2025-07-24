import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createGetTodoSuccessResponseBody } from "./GetTodoResponseUtils";
import { createCreateTodoSuccessResponseHeaders } from "./CreateTodoResponseUtils";
import type {
  IUpdateTodoSuccessResponse,
  IUpdateTodoSuccessResponseHeader,
  IUpdateTodoSuccessResponseBody,
} from "../..";

export function createUpdateTodoSuccessResponseHeaders(
  input: Partial<IUpdateTodoSuccessResponseHeader> = {}
): IUpdateTodoSuccessResponseHeader {
  return createCreateTodoSuccessResponseHeaders(input);
}

export function createUpdateTodoSuccessResponseBody(
  input: Partial<IUpdateTodoSuccessResponseBody> = {}
): IUpdateTodoSuccessResponseBody {
  return createGetTodoSuccessResponseBody(input);
}

type UpdateTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUpdateTodoSuccessResponseHeader>;
  body?: Partial<IUpdateTodoSuccessResponseBody>;
};

export function createUpdateTodoSuccessResponse(
  input: UpdateTodoSuccessResponseInput = {}
): IUpdateTodoSuccessResponse {
  const defaults: IUpdateTodoSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createUpdateTodoSuccessResponseHeaders(),
    body: createUpdateTodoSuccessResponseBody(),
  };

  const overrides: Partial<IUpdateTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createUpdateTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined) overrides.body = createUpdateTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
