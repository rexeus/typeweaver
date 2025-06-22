import definition from "../../definition/funnel/GetFunnelDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { GetFunnelResponseValidator } from "./GetFunnelResponseValidator";
import {
  type GetFunnelResponse,
  GetFunnelSuccessResponse,
} from "./GetFunnelResponse";

import { FunnelNotFoundErrorResponse } from "../shared/FunnelNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IGetFunnelRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IGetFunnelRequestParam = {
  funnelId: string;
};

export type IGetFunnelRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IGetFunnelRequestHeader;
  param: IGetFunnelRequestParam;
};

export type SuccessfulGetFunnelResponse = Exclude<
  GetFunnelResponse,
  | FunnelNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class GetFunnelRequestCommand
  extends RequestCommand
  implements IGetFunnelRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IGetFunnelRequestHeader;
  public override readonly param: IGetFunnelRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: GetFunnelResponseValidator;

  public constructor(input: Omit<IGetFunnelRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new GetFunnelResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulGetFunnelResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof GetFunnelSuccessResponse) {
      return result;
    }

    throw result;
  }
}
