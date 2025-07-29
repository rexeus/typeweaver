import { HttpMethod } from "@rexeus/typeweaver-core";
import { type HeadTodoResponse } from "./HeadTodoResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IHeadTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IHeadTodoRequestParam = {
  todoId: string;
};

export type IHeadTodoRequest = {
  path: string;
  method: HttpMethod.HEAD;
  header: IHeadTodoRequestHeader;
  param: IHeadTodoRequestParam;
};

export type SuccessfulHeadTodoResponse = Exclude<
  HeadTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
