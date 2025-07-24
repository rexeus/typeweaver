import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createCreateTodoSuccessResponseHeaders } from "./CreateTodoResponseUtils";
import type {
  IDeleteTodoSuccessResponse,
  IDeleteTodoSuccessResponseHeader,
} from "../..";

export function createDeleteTodoSuccessResponseHeaders(
  input: Partial<IDeleteTodoSuccessResponseHeader> = {}
): IDeleteTodoSuccessResponseHeader {
  return createCreateTodoSuccessResponseHeaders(input);
}

type DeleteTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IDeleteTodoSuccessResponseHeader>;
};

export function createDeleteTodoSuccessResponse(
  input: DeleteTodoSuccessResponseInput = {}
): IDeleteTodoSuccessResponse {
  const defaults: IDeleteTodoSuccessResponse = {
    statusCode: HttpStatusCode.NO_CONTENT,
    header: createDeleteTodoSuccessResponseHeaders(),
  };

  const overrides: Partial<IDeleteTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createDeleteTodoSuccessResponseHeaders(input.header);

  return createData(defaults, overrides);
}
