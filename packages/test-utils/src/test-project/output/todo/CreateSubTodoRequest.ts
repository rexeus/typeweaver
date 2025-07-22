import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type CreateSubTodoResponse,
  CreateSubTodoSuccessResponse,
} from "./CreateSubTodoResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type ICreateSubTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type ICreateSubTodoRequestParam = {
  todoId: string;
};

export type ICreateSubTodoRequestBody = {
  title: string;
  description?: string | undefined;
  dueDate?: string | undefined;
  tags?: string[] | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
};

export type ICreateSubTodoRequest = {
  path: string;
  method: HttpMethod.POST;
  header: ICreateSubTodoRequestHeader;
  param: ICreateSubTodoRequestParam;

  body: ICreateSubTodoRequestBody;
};

export type SuccessfulCreateSubTodoResponse = Exclude<
  CreateSubTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
