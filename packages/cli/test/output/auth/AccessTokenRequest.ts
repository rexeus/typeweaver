import definition from "../../definition/auth/AccessTokenDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { AccessTokenResponseValidator } from "./AccessTokenResponseValidator";
import {
  type AccessTokenResponse,
  AccessTokenSuccessResponse,
} from "./AccessTokenResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IAccessTokenRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
};

export type IAccessTokenRequestBody = {
  email: string;
  password: string;
};

export type IAccessTokenRequest = {
  path: string;
  method: HttpMethod.POST;
  header: IAccessTokenRequestHeader;

  body: IAccessTokenRequestBody;
};

export type SuccessfulAccessTokenResponse = Exclude<
  AccessTokenResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class AccessTokenRequestCommand
  extends RequestCommand
  implements IAccessTokenRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: IAccessTokenRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: IAccessTokenRequestBody;

  private readonly responseValidator: AccessTokenResponseValidator;

  public constructor(input: Omit<IAccessTokenRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new AccessTokenResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulAccessTokenResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof AccessTokenSuccessResponse) {
      return result;
    }

    throw result;
  }
}
