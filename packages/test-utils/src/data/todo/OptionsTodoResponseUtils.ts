import { createData } from "../createData";
import type {
  IOptionsTodoSuccessResponse,
  IOptionsTodoSuccessResponseHeader,
} from "../..";

export function createOptionsTodoSuccessResponseHeaders(
  input: Partial<IOptionsTodoSuccessResponseHeader> = {}
): IOptionsTodoSuccessResponseHeader {
  const defaults: IOptionsTodoSuccessResponseHeader = {
    Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  };

  return createData(defaults, input);
}

type CreateOptionsTodoSuccessResponseInput = {
  header?: Partial<IOptionsTodoSuccessResponseHeader>;
};

export function createOptionsTodoSuccessResponse(
  input: CreateOptionsTodoSuccessResponseInput = {}
): IOptionsTodoSuccessResponse {
  const header = input.header
    ? createOptionsTodoSuccessResponseHeaders(input.header)
    : createOptionsTodoSuccessResponseHeaders();

  const defaults: IOptionsTodoSuccessResponse = {
    statusCode: 200,
    header,
  };

  return createData(defaults, input as IOptionsTodoSuccessResponse);
}