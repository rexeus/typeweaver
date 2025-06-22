import definition from "../../definition/funnel/ListFunnelDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { ListFunnelResponseValidator } from "./ListFunnelResponseValidator";
import {
  type ListFunnelResponse,
  ListFunnelSuccessResponse,
} from "./ListFunnelResponse";

import { NonExistingProjectErrorResponse } from "../shared/NonExistingProjectErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListFunnelRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IListFunnelRequestQuery = {
  projectId: string;
};

export type IListFunnelRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListFunnelRequestHeader;

  query: IListFunnelRequestQuery;
};

export type SuccessfulListFunnelResponse = Exclude<
  ListFunnelResponse,
  | NonExistingProjectErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class ListFunnelRequestCommand
  extends RequestCommand
  implements IListFunnelRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IListFunnelRequestHeader;
  declare public readonly param: undefined;
  public override readonly query: IListFunnelRequestQuery;
  declare public readonly body: undefined;

  private readonly responseValidator: ListFunnelResponseValidator;

  public constructor(input: Omit<IListFunnelRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.query = input.query;

    this.responseValidator = new ListFunnelResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulListFunnelResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof ListFunnelSuccessResponse) {
      return result;
    }

    throw result;
  }
}
