import { HttpMethod } from "@rexeus/typeweaver-core";
import { type QuerySubTodoResponse } from "./QuerySubTodoResponse";

import { TodoNotFoundErrorResponse } from "./TodoNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IQuerySubTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IQuerySubTodoRequestParam = {
  todoId: string;
};

export type IQuerySubTodoRequestQuery = {
  limit?: string | undefined;
  nextToken?: string | undefined;
  sortBy?:
    | ("title" | "dueDate" | "priority" | "createdAt" | "modifiedAt")
    | undefined;
  sortOrder?: ("asc" | "desc") | undefined;
  format?: ("summary" | "detailed") | undefined;
};

export type IQuerySubTodoRequestBody = {
  searchText?: string | undefined;
  status?: ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED") | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
  dateRange?:
    | {
        from?: string | undefined;
        to?: string | undefined;
      }
    | undefined;
  tags?: string[] | undefined;
};

export type IQuerySubTodoRequest = {
  path: string;
  method: HttpMethod.POST;
  header: IQuerySubTodoRequestHeader;
  param: IQuerySubTodoRequestParam;
  query: IQuerySubTodoRequestQuery;
  body: IQuerySubTodoRequestBody;
};

export type SuccessfulQuerySubTodoResponse = Exclude<
  QuerySubTodoResponse,
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
