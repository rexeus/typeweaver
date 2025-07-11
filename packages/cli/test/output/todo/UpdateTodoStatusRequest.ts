import definition from "../../definition/todo/UpdateTodoStatusDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { UpdateTodoStatusResponseValidator } from "./UpdateTodoStatusResponseValidator";
import {
  type UpdateTodoStatusResponse,
  UpdateTodoStatusSuccessResponse,
} from "./UpdateTodoStatusResponse";

import { TodoNotFoundErrorResponse } from "../shared/TodoNotFoundErrorResponse";

import { TodoStatusTransitionInvalidErrorResponse } from "../shared/TodoStatusTransitionInvalidErrorResponse";

import { TodoNotChangeableErrorResponse } from "../shared/TodoNotChangeableErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IUpdateTodoStatusRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IUpdateTodoStatusRequestParam = {
  todoId: string;
};

export type IUpdateTodoStatusRequestBody = {
  value: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
};

export type IUpdateTodoStatusRequest = {
  path: string;
  method: HttpMethod.PUT;
  header: IUpdateTodoStatusRequestHeader;
  param: IUpdateTodoStatusRequestParam;

  body: IUpdateTodoStatusRequestBody;
};

export type SuccessfulUpdateTodoStatusResponse = Exclude<
  UpdateTodoStatusResponse,
  | TodoNotFoundErrorResponse
  | TodoStatusTransitionInvalidErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class UpdateTodoStatusRequestCommand
  extends RequestCommand
  implements IUpdateTodoStatusRequest
{
  public override readonly method = definition.method as HttpMethod.PUT;
  public override readonly path = definition.path;

  public override readonly header: IUpdateTodoStatusRequestHeader;
  public override readonly param: IUpdateTodoStatusRequestParam;
  declare public readonly query: undefined;
  public override readonly body: IUpdateTodoStatusRequestBody;

  private readonly responseValidator: UpdateTodoStatusResponseValidator;

  public constructor(input: Omit<IUpdateTodoStatusRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.body = input.body;

    this.responseValidator = new UpdateTodoStatusResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulUpdateTodoStatusResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof UpdateTodoStatusSuccessResponse) {
      return result;
    }

    throw result;
  }
}
