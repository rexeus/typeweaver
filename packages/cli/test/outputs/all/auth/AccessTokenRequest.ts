import { HttpMethod } from "@rexeus/typeweaver-core";
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
