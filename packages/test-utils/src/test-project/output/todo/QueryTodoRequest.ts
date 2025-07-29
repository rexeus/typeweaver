import { HttpMethod } from "@rexeus/typeweaver-core";
import { type QueryTodoResponse } from "./QueryTodoResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IQueryTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IQueryTodoRequestQuery = {
  limit?: string | undefined;
  nextToken?: string | undefined;
  sortBy?:
    | ("title" | "dueDate" | "priority" | "createdAt" | "modifiedAt")
    | undefined;
  sortOrder?: ("asc" | "desc") | undefined;
};

export type IQueryTodoRequestBody = {
  searchText?: string | undefined;
  accountId?: string | undefined;
  status?: ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED") | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
  dateRange?:
    | {
        from?: string | undefined;
        to?: string | undefined;
      }
    | undefined;
  tags?: string[] | undefined;
  hasParent?: boolean | undefined;
};

export type IQueryTodoRequest = {
  path: string;
  method: HttpMethod.POST;
  header: IQueryTodoRequestHeader;

  query: IQueryTodoRequestQuery;
  body: IQueryTodoRequestBody;
};

export type SuccessfulQueryTodoResponse = Exclude<
  QueryTodoResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
