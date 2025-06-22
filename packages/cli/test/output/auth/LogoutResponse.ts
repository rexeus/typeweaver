import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  IForbiddenErrorResponse,
  ForbiddenErrorResponse,
} from "../shared/ForbiddenErrorResponse";

import type {
  IInternalServerErrorResponse,
  InternalServerErrorResponse,
} from "../shared/InternalServerErrorResponse";

import type {
  ITooManyRequestsErrorResponse,
  TooManyRequestsErrorResponse,
} from "../shared/TooManyRequestsErrorResponse";

import type {
  IUnauthorizedErrorResponse,
  UnauthorizedErrorResponse,
} from "../shared/UnauthorizedErrorResponse";

import type {
  IUnsupportedMediaTypeErrorResponse,
  UnsupportedMediaTypeErrorResponse,
} from "../shared/UnsupportedMediaTypeErrorResponse";

import type {
  IValidationErrorResponse,
  ValidationErrorResponse,
} from "../shared/ValidationErrorResponse";

export type ILogoutSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type ILogoutSuccessResponse = {
  statusCode: HttpStatusCode.NO_CONTENT;
  header: ILogoutSuccessResponseHeader;
};

export class LogoutSuccessResponse
  extends HttpResponse<ILogoutSuccessResponseHeader, undefined>
  implements ILogoutSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.NO_CONTENT;

  public constructor(response: ILogoutSuccessResponse) {
    super(response.statusCode, response.header, undefined);

    if (response.statusCode !== HttpStatusCode.NO_CONTENT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for LogoutSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type ILogoutSuccessResponses = ILogoutSuccessResponse;

export type LogoutSuccessResponses = LogoutSuccessResponse;

export type ILogoutResponse =
  | ILogoutSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type LogoutResponse =
  | LogoutSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
