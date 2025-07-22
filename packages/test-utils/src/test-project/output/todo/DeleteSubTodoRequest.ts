import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type DeleteSubTodoResponse,
  DeleteSubTodoSuccessResponse,
} from "./DeleteSubTodoResponse";

import { SubTodoNotFoundErrorResponse } from "./SubTodoNotFoundErrorResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IDeleteSubTodoRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IDeleteSubTodoRequestParam = {
  todoId: string;
  subtodoId: string;
};

export type IDeleteSubTodoRequest = {
  path: string;
  method: HttpMethod.DELETE;
  header: IDeleteSubTodoRequestHeader;
  param: IDeleteSubTodoRequestParam;
};

export type SuccessfulDeleteSubTodoResponse = Exclude<
  DeleteSubTodoResponse,
  | SubTodoNotFoundErrorResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
