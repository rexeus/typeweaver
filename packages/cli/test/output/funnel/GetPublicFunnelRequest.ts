import definition from "../../definition/funnel/GetPublicFunnelDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { GetPublicFunnelResponseValidator } from "./GetPublicFunnelResponseValidator";
import {
  type GetPublicFunnelResponse,
  GetPublicFunnelSuccessResponse,
} from "./GetPublicFunnelResponse";

import { FunnelNotFoundErrorResponse } from "../shared/FunnelNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IGetPublicFunnelRequestHeader = {
  Accept: "application/json";
};

export type IGetPublicFunnelRequestParam = {
  funnelId: string;
};

export type IGetPublicFunnelRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IGetPublicFunnelRequestHeader;
  param: IGetPublicFunnelRequestParam;
};

export type SuccessfulGetPublicFunnelResponse = Exclude<
  GetPublicFunnelResponse,
  | FunnelNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class GetPublicFunnelRequestCommand
  extends RequestCommand
  implements IGetPublicFunnelRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IGetPublicFunnelRequestHeader;
  public override readonly param: IGetPublicFunnelRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: GetPublicFunnelResponseValidator;

  public constructor(input: Omit<IGetPublicFunnelRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new GetPublicFunnelResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulGetPublicFunnelResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof GetPublicFunnelSuccessResponse) {
      return result;
    }

    throw result;
  }
}
