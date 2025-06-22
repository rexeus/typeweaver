import definition from "../../definition/ad/GetAdDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { GetAdResponseValidator } from "./GetAdResponseValidator";
import { type GetAdResponse, GetAdSuccessResponse } from "./GetAdResponse";

import { AdNotFoundErrorResponse } from "../shared/AdNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IGetAdRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IGetAdRequestParam = {
  adId: string;
};

export type IGetAdRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IGetAdRequestHeader;
  param: IGetAdRequestParam;
};

export type SuccessfulGetAdResponse = Exclude<
  GetAdResponse,
  | AdNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class GetAdRequestCommand
  extends RequestCommand
  implements IGetAdRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IGetAdRequestHeader;
  public override readonly param: IGetAdRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: GetAdResponseValidator;

  public constructor(input: Omit<IGetAdRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new GetAdResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulGetAdResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof GetAdSuccessResponse) {
      return result;
    }

    throw result;
  }
}
