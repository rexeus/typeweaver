import definition from "../../definition/todo/DeleteTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { DeleteTodoResponseValidator } from "./DeleteTodoResponseValidator";
import {
  type DeleteTodoResponse,
  DeleteTodoSuccessResponse,
} from "./DeleteTodoResponse";

import { TodoNotFoundErrorResponse } from "../shared/TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IDeleteTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IDeleteTodoRequestParam = {
  todoId: string;
};

export type IDeleteTodoRequest = {
  path: string;
  method: HttpMethod.DELETE;
  header: IDeleteTodoRequestHeader;
  param: IDeleteTodoRequestParam;
};

export type SuccessfulDeleteTodoResponse = Exclude<
  DeleteTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class DeleteTodoRequestCommand
  extends RequestCommand
  implements IDeleteTodoRequest
{
  public override readonly method = definition.method as HttpMethod.DELETE;
  public override readonly path = definition.path;

  public override readonly header: IDeleteTodoRequestHeader;
  public override readonly param: IDeleteTodoRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: DeleteTodoResponseValidator;

  public constructor(input: Omit<IDeleteTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new DeleteTodoResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulDeleteTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof DeleteTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
