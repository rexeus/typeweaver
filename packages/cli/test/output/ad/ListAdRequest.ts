import definition from "../../definition/ad/ListAdDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { ListAdResponseValidator } from "./ListAdResponseValidator";
import { type ListAdResponse, ListAdSuccessResponse } from "./ListAdResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListAdRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IListAdRequestQuery = {
  projectId: string;
};

export type IListAdRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListAdRequestHeader;

  query: IListAdRequestQuery;
};

export type SuccessfulListAdResponse = Exclude<
  ListAdResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class ListAdRequestCommand
  extends RequestCommand
  implements IListAdRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IListAdRequestHeader;
  declare public readonly param: undefined;
  public override readonly query: IListAdRequestQuery;
  declare public readonly body: undefined;

  private readonly responseValidator: ListAdResponseValidator;

  public constructor(input: Omit<IListAdRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.query = input.query;

    this.responseValidator = new ListAdResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulListAdResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof ListAdSuccessResponse) {
      return result;
    }

    throw result;
  }
}
