import { HttpMethod } from "@rexeus/typeweaver-core";
import { type ListTodosResponse } from "./ListTodosResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListTodosRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IListTodosRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListTodosRequestHeader;
};

export type SuccessfulListTodosResponse = Exclude<
  ListTodosResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
