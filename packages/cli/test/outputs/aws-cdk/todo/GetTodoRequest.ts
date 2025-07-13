import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type GetTodoResponse,
  GetTodoSuccessResponse,
} from "./GetTodoResponse";

import { TodoNotFoundErrorResponse } from "../shared/TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IGetTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IGetTodoRequestParam = {
  todoId: string;
};

export type IGetTodoRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IGetTodoRequestHeader;
  param: IGetTodoRequestParam;
};

export type SuccessfulGetTodoResponse = Exclude<
  GetTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
