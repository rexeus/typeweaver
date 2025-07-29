import { HttpMethod } from "@rexeus/typeweaver-core";
import { type RegisterAccountResponse } from "./RegisterAccountResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IRegisterAccountRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
};

export type IRegisterAccountRequestBody = {
  email: string;
  password: string;
};

export type IRegisterAccountRequest = {
  path: string;
  method: HttpMethod.POST;
  header: IRegisterAccountRequestHeader;

  body: IRegisterAccountRequestBody;
};

export type SuccessfulRegisterAccountResponse = Exclude<
  RegisterAccountResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
