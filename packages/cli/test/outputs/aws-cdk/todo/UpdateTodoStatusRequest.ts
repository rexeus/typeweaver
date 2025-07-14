import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type UpdateTodoStatusResponse,
  UpdateTodoStatusSuccessResponse,
} from "./UpdateTodoStatusResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { TodoStatusTransitionInvalidErrorResponse } from "./TodoStatusTransitionInvalidErrorResponse";

import { TodoNotChangeableErrorResponse } from "./TodoNotChangeableErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IUpdateTodoStatusRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IUpdateTodoStatusRequestParam = {
  todoId: string;
};

export type IUpdateTodoStatusRequestBody = {
  value: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
};

export type IUpdateTodoStatusRequest = {
  path: string;
  method: HttpMethod.PUT;
  header: IUpdateTodoStatusRequestHeader;
  param: IUpdateTodoStatusRequestParam;

  body: IUpdateTodoStatusRequestBody;
};

export type SuccessfulUpdateTodoStatusResponse = Exclude<
  UpdateTodoStatusResponse,
  | TodoNotFoundErrorResponse
  | TodoStatusTransitionInvalidErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
