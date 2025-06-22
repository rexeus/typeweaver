import definition from "../../definition/auth/LogoutDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { LogoutResponseValidator } from "./LogoutResponseValidator";
import { type LogoutResponse, LogoutSuccessResponse } from "./LogoutResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type ILogoutRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
};

export type ILogoutRequestBody = {
  refreshToken: string;
};

export type ILogoutRequest = {
  path: string;
  method: HttpMethod.POST;
  header: ILogoutRequestHeader;

  body: ILogoutRequestBody;
};

export type SuccessfulLogoutResponse = Exclude<
  LogoutResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class LogoutRequestCommand
  extends RequestCommand
  implements ILogoutRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: ILogoutRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: ILogoutRequestBody;

  private readonly responseValidator: LogoutResponseValidator;

  public constructor(input: Omit<ILogoutRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new LogoutResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulLogoutResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof LogoutSuccessResponse) {
      return result;
    }

    throw result;
  }
}
