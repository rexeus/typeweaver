import definition from "../../../definition/todo/UpdateTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { UpdateTodoResponseValidator } from "./UpdateTodoResponseValidator";
import {
  type UpdateTodoResponse,
  UpdateTodoSuccessResponse,
} from "./UpdateTodoResponse";

import { TodoNotFoundErrorResponse } from "../shared/TodoNotFoundErrorResponse";

import { TodoNotChangeableErrorResponse } from "../shared/TodoNotChangeableErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IUpdateTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IUpdateTodoRequestParam = {
  todoId: string;
};

export type IUpdateTodoRequestBody = {
  title?: string | undefined;
  description?: (string | undefined) | undefined;
  dueDate?: (string | undefined) | undefined;
  tags?: (string[] | undefined) | undefined;
  priority?: (("LOW" | "MEDIUM" | "HIGH") | undefined) | undefined;
};

export type IUpdateTodoRequest = {
  path: string;
  method: HttpMethod.PATCH;
  header: IUpdateTodoRequestHeader;
  param: IUpdateTodoRequestParam;

  body: IUpdateTodoRequestBody;
};

export type SuccessfulUpdateTodoResponse = Exclude<
  UpdateTodoResponse,
  | TodoNotFoundErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class UpdateTodoRequestCommand
  extends RequestCommand
  implements IUpdateTodoRequest
{
  public override readonly method = definition.method as HttpMethod.PATCH;
  public override readonly path = definition.path;

  public override readonly header: IUpdateTodoRequestHeader;
  public override readonly param: IUpdateTodoRequestParam;
  declare public readonly query: undefined;
  public override readonly body: IUpdateTodoRequestBody;

  private readonly responseValidator: UpdateTodoResponseValidator;

  public constructor(input: Omit<IUpdateTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.body = input.body;

    this.responseValidator = new UpdateTodoResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulUpdateTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof UpdateTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
