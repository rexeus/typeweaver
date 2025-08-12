import { HttpMethod } from "@rexeus/typeweaver-core";
import { type DeleteTodoResponse } from "./DeleteTodoResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IDeleteTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IDeleteTodoRequestParam = {
  todoId: string;
};

export type IDeleteTodoRequest = {
  path: string;
  method: HttpMethod.DELETE;
  header: IDeleteTodoRequestHeader;
  param: IDeleteTodoRequestParam;
};

export type SuccessfulDeleteTodoResponse = Exclude<
  DeleteTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
