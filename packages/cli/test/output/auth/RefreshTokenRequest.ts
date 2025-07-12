import definition from "../../definition/auth/RefreshTokenDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { RefreshTokenResponseValidator } from "./RefreshTokenResponseValidator";
import {
  type RefreshTokenResponse,
  RefreshTokenSuccessResponse,
} from "./RefreshTokenResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IRefreshTokenRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
};

export type IRefreshTokenRequestBody = {
  refreshToken: string;
};

export type IRefreshTokenRequest = {
  path: string;
  method: HttpMethod.POST;
  header: IRefreshTokenRequestHeader;

  body: IRefreshTokenRequestBody;
};

export type SuccessfulRefreshTokenResponse = Exclude<
  RefreshTokenResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class RefreshTokenRequestCommand
  extends RequestCommand
  implements IRefreshTokenRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: IRefreshTokenRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: IRefreshTokenRequestBody;

  private readonly responseValidator: RefreshTokenResponseValidator;

  public constructor(input: Omit<IRefreshTokenRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new RefreshTokenResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulRefreshTokenResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof RefreshTokenSuccessResponse) {
      return result;
    }

    throw result;
  }
}
