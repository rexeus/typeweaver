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

export type IRefreshTokenSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IRefreshTokenSuccessResponseBody = {
  accessToken: string;
  refreshToken: string;
};

export type IRefreshTokenSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IRefreshTokenSuccessResponseHeader;
  body: IRefreshTokenSuccessResponseBody;
};

export class RefreshTokenSuccessResponse
  extends HttpResponse<
    IRefreshTokenSuccessResponseHeader,
    IRefreshTokenSuccessResponseBody
  >
  implements IRefreshTokenSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IRefreshTokenSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for RefreshTokenSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IRefreshTokenSuccessResponses = IRefreshTokenSuccessResponse;

export type RefreshTokenSuccessResponses = RefreshTokenSuccessResponse;

export type IRefreshTokenResponse =
  | IRefreshTokenSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type RefreshTokenResponse =
  | RefreshTokenSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
