import { HttpMethod } from "@rexeus/typeweaver-core";
import { type RefreshTokenResponse } from "./RefreshTokenResponse";

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
