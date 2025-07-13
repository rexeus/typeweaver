import definition from "../../../definition/todo/ListTodosDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { ListTodosResponseValidator } from "./ListTodosResponseValidator";
import {
  type ListTodosResponse,
  ListTodosSuccessResponse,
} from "./ListTodosResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListTodosRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IListTodosRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListTodosRequestHeader;
};

export type SuccessfulListTodosResponse = Exclude<
  ListTodosResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class ListTodosRequestCommand
  extends RequestCommand
  implements IListTodosRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IListTodosRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: ListTodosResponseValidator;

  public constructor(input: Omit<IListTodosRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.responseValidator = new ListTodosResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulListTodosResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof ListTodosSuccessResponse) {
      return result;
    }

    throw result;
  }
}
