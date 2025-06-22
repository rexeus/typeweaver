import definition from "../../definition/project/ListProjectDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { ListProjectResponseValidator } from "./ListProjectResponseValidator";
import {
  type ListProjectResponse,
  ListProjectSuccessResponse,
} from "./ListProjectResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListProjectRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IListProjectRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListProjectRequestHeader;
};

export type SuccessfulListProjectResponse = Exclude<
  ListProjectResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class ListProjectRequestCommand
  extends RequestCommand
  implements IListProjectRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IListProjectRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: ListProjectResponseValidator;

  public constructor(input: Omit<IListProjectRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.responseValidator = new ListProjectResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulListProjectResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof ListProjectSuccessResponse) {
      return result;
    }

    throw result;
  }
}
