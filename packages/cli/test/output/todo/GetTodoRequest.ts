import definition from "../../definition/todo/GetTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { GetTodoResponseValidator } from "./GetTodoResponseValidator";
import {
  type GetTodoResponse,
  GetTodoSuccessResponse,
} from "./GetTodoResponse";

import { TodoNotFoundErrorResponse } from "../shared/TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IGetTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IGetTodoRequestParam = {
  todoId: string;
};

export type IGetTodoRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IGetTodoRequestHeader;
  param: IGetTodoRequestParam;
};

export type SuccessfulGetTodoResponse = Exclude<
  GetTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class GetTodoRequestCommand
  extends RequestCommand
  implements IGetTodoRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IGetTodoRequestHeader;
  public override readonly param: IGetTodoRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: GetTodoResponseValidator;

  public constructor(input: Omit<IGetTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new GetTodoResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulGetTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof GetTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
