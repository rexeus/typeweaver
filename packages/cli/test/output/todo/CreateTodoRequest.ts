import definition from "../../definition/todo/CreateTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { CreateTodoResponseValidator } from "./CreateTodoResponseValidator";
import {
  type CreateTodoResponse,
  CreateTodoSuccessResponse,
} from "./CreateTodoResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type ICreateTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type ICreateTodoRequestBody = {
  title: string;
  description?: string | undefined;
  dueDate?: string | undefined;
  tags?: string[] | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
};

export type ICreateTodoRequest = {
  path: string;
  method: HttpMethod.POST;
  header: ICreateTodoRequestHeader;

  body: ICreateTodoRequestBody;
};

export type SuccessfulCreateTodoResponse = Exclude<
  CreateTodoResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class CreateTodoRequestCommand
  extends RequestCommand
  implements ICreateTodoRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: ICreateTodoRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: ICreateTodoRequestBody;

  private readonly responseValidator: CreateTodoResponseValidator;

  public constructor(input: Omit<ICreateTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new CreateTodoResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulCreateTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof CreateTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
