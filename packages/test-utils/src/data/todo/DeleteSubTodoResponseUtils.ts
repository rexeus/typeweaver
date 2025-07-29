import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IDeleteSubTodoSuccessResponseBody,
  IDeleteSubTodoSuccessResponseHeader,
  IDeleteSubTodoSuccessResponse,
} from "../..";
import { createData } from "../createData";

export function createDeleteSubTodoSuccessResponseHeaders(
  input: Partial<IDeleteSubTodoSuccessResponseHeader> = {}
): IDeleteSubTodoSuccessResponseHeader {
  const defaults: IDeleteSubTodoSuccessResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createDeleteSubTodoSuccessResponseBody(
  input: Partial<IDeleteSubTodoSuccessResponseBody> = {}
): IDeleteSubTodoSuccessResponseBody {
  const defaults: IDeleteSubTodoSuccessResponseBody = {
    message: faker.lorem.sentence(),
  };

  return createData(defaults, input);
}

type DeleteSubTodoSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IDeleteSubTodoSuccessResponseHeader>;
  body?: Partial<IDeleteSubTodoSuccessResponseBody>;
};

export function createDeleteSubTodoSuccessResponse(
  input: DeleteSubTodoSuccessResponseInput = {}
): IDeleteSubTodoSuccessResponse {
  const defaults: IDeleteSubTodoSuccessResponse = {
    statusCode: HttpStatusCode.OK,
    header: createDeleteSubTodoSuccessResponseHeaders(),
    body: createDeleteSubTodoSuccessResponseBody(),
  };

  const overrides: Partial<IDeleteSubTodoSuccessResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createDeleteSubTodoSuccessResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createDeleteSubTodoSuccessResponseBody(input.body);

  return createData(defaults, overrides);
}
