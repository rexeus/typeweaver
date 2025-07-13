import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type UpdateTodoResponse,
  UpdateTodoSuccessResponse,
} from "./UpdateTodoResponse";

import { TodoNotFoundErrorResponse } from "../shared/TodoNotFoundErrorResponse";

import { TodoNotChangeableErrorResponse } from "../shared/TodoNotChangeableErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IUpdateTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IUpdateTodoRequestParam = {
  todoId: string;
};

export type IUpdateTodoRequestBody = {
  title?: string | undefined;
  description?: (string | undefined) | undefined;
  dueDate?: (string | undefined) | undefined;
  tags?: (string[] | undefined) | undefined;
  priority?: (("LOW" | "MEDIUM" | "HIGH") | undefined) | undefined;
};

export type IUpdateTodoRequest = {
  path: string;
  method: HttpMethod.PATCH;
  header: IUpdateTodoRequestHeader;
  param: IUpdateTodoRequestParam;

  body: IUpdateTodoRequestBody;
};

export type SuccessfulUpdateTodoResponse = Exclude<
  UpdateTodoResponse,
  | TodoNotFoundErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
