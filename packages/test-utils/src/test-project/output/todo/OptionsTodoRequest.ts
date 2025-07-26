import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type OptionsTodoResponse,
  OptionsTodoSuccessResponse,
} from "./OptionsTodoResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IOptionsTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IOptionsTodoRequestParam = {
  todoId: string;
};

export type IOptionsTodoRequest = {
  path: string;
  method: HttpMethod.OPTIONS;
  header: IOptionsTodoRequestHeader;
  param: IOptionsTodoRequestParam;
};

export type SuccessfulOptionsTodoResponse = Exclude<
  OptionsTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
