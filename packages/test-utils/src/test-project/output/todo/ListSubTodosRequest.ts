import { HttpMethod } from "@rexeus/typeweaver-core";
import { type ListSubTodosResponse } from "./ListSubTodosResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListSubTodosRequestHeader = {
  Accept: "application/json";
  Authorization: string;
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IListSubTodosRequestParam = {
  todoId: string;
};

export type IListSubTodosRequestQuery = {
  limit?: string | undefined;
  nextToken?: string | undefined;
  sortBy?:
    | ("title" | "dueDate" | "priority" | "createdAt" | "modifiedAt")
    | undefined;
  sortOrder?: ("asc" | "desc") | undefined;
};

export type IListSubTodosRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListSubTodosRequestHeader;
  param: IListSubTodosRequestParam;
  query: IListSubTodosRequestQuery;
};

export type SuccessfulListSubTodosResponse = Exclude<
  ListSubTodosResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
