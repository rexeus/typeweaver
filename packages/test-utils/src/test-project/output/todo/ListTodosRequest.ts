import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type ListTodosResponse,
  ListTodosSuccessResponse,
} from "./ListTodosResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IListTodosRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IListTodosRequestQuery = {
  status?: ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED") | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
  tags?: string[] | undefined;
  limit?: string | undefined;
  nextToken?: string | undefined;
  sortBy?:
    | ("title" | "dueDate" | "priority" | "createdAt" | "modifiedAt")
    | undefined;
  sortOrder?: ("asc" | "desc") | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

export type IListTodosRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IListTodosRequestHeader;

  query: IListTodosRequestQuery;
};

export type SuccessfulListTodosResponse = Exclude<
  ListTodosResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
