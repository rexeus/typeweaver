import { createData } from "../createData";
import type {
  IHeadTodoSuccessResponse,
  IHeadTodoSuccessResponseHeader,
} from "../..";

export function createHeadTodoSuccessResponseHeaders(
  input: Partial<IHeadTodoSuccessResponseHeader> = {}
): IHeadTodoSuccessResponseHeader {
  const defaults: IHeadTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

type CreateHeadTodoSuccessResponseInput = {
  header?: Partial<IHeadTodoSuccessResponseHeader>;
};

export function createHeadTodoSuccessResponse(
  input: CreateHeadTodoSuccessResponseInput = {}
): IHeadTodoSuccessResponse {
  const header = input.header
    ? createHeadTodoSuccessResponseHeaders(input.header)
    : createHeadTodoSuccessResponseHeaders();

  const defaults: IHeadTodoSuccessResponse = {
    statusCode: 200,
    header,
  };

  return createData(defaults, input as IHeadTodoSuccessResponse);
}
